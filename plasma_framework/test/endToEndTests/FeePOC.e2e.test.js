const EthVault = artifacts.require('EthVault');
const FeeOutputToPaymentTxCondition = artifacts.require('FeeOutputToPaymentTxCondition');
const FeeOutputGuardHandler = artifacts.require('FeeOutputGuardHandler');
const FeeExitGame = artifacts.require('FeeExitGame');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentOutputGuardHandler = artifacts.require('PaymentOutputGuardHandler');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const {
    constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const config = require('../../config.js');

const { EMPTY_BYTES } = require('../helpers/constants.js');
const {
    PaymentTransactionOutput, PaymentTransaction, FeeTransaction,
    FeeNonceOutput, WireTransactionOutput,
} = require('../helpers/transaction.js');
const { sign } = require('../helpers/sign.js');
const { hashTx, INPUT_SCHEMA } = require('../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const { MerkleTree } = require('../helpers/merkle.js');
const { computeNormalOutputId } = require('../helpers/utils.js');

/**
 * First three accounts are in the order of (deployer, maintainer, authority).
 * This is how migration scripts use the account.
 */
contract.only('PlasmaFramework - Fee Exit POC', ([_, maintainer, authority, richFather]) => {
    const MERKLE_TREE_DEPTH = 16;
    const ETH = constants.ZERO_ADDRESS;
    const PAYMENT_V1_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
    const PAYMENT_V2_OUTPUT_TYPE = 11111;
    const PAYMENT_V1_TX_TYPE = config.registerKeys.txTypes.payment;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;
    const FEE_TX_TYPE = 12345;
    // this is the Fee output type that can be spend by Payment v2
    const FEE_OUTPUT_TYPE = 1234;
    // this is a output type just for holding nonce
    const FEE_NONCE_OUTPUT_TYPE = 1235;
    const DEPOSIT_VALUE = 1000000;

    const FEE_AMOUNT = 1000;
    const FEE_NONCE_1 = 1;
    const FEE_NONCE_2 = 2;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    const operatorFeeAddressPrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10cb';
    let alice;
    let operatorFeeAddress;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });

        operatorFeeAddress = await web3.eth.personal.importRawKey(operatorFeeAddressPrivateKey, password);
        operatorFeeAddress = web3.utils.toChecksumAddress(operatorFeeAddress);
        web3.eth.personal.unlockAccount(operatorFeeAddress, password, 3600);
        web3.eth.sendTransaction({ to: operatorFeeAddress, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    describe('Given PlasmaFramework, ETH Vault and PaymentExitGame deployed', () => {
        before(async () => {
            await setupAccount();

            this.framework = await PlasmaFramework.deployed();
            this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
            this.paymentExitGame = await PaymentExitGame.at(
                await this.framework.exitGames(config.registerKeys.txTypes.payment),
            );

            this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
        });

        describe('When Maintainer registers new Exit Game contracts for PaymentExitGame V2 and Fee and waits for three weeks', () => {
            /**
             * This Payment V2 would be able to accept Payment V1 output, Fee output and Payment V2 output as input.
             * As a result, we would need to register OutputGuardHandler, SpendingCondition for the combination
             * of three types.
             */
            before(async () => {
                const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
                const feeOutputGuardHandler = await FeeOutputGuardHandler.new();
                const paymentOutputGuardHandler = await PaymentOutputGuardHandler.new();
                await outputGuardHandlerRegistry.registerOutputGuardHandler(
                    FEE_OUTPUT_TYPE, feeOutputGuardHandler.address,
                );
                await outputGuardHandlerRegistry.registerOutputGuardHandler(
                    PAYMENT_V1_OUTPUT_TYPE, paymentOutputGuardHandler.address,
                );
                await outputGuardHandlerRegistry.registerOutputGuardHandler(
                    PAYMENT_V2_OUTPUT_TYPE, paymentOutputGuardHandler.address,
                );
                await outputGuardHandlerRegistry.renounceOwnership();

                const spendingConditionRegistry = await SpendingConditionRegistry.new();
                const paymentV1ToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.new(
                    this.framework.address, PAYMENT_V1_TX_TYPE, PAYMENT_V2_TX_TYPE,
                );
                const paymentV2ToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.new(
                    this.framework.address, PAYMENT_V2_TX_TYPE, PAYMENT_V2_TX_TYPE,
                );
                const feeToPaymentV2Condition = await FeeOutputToPaymentTxCondition.new(
                    this.framework.address, FEE_TX_TYPE, PAYMENT_V2_TX_TYPE,
                );
                await spendingConditionRegistry.registerSpendingCondition(
                    PAYMENT_V1_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentV1ToPaymentV2Condition.address,
                );
                await spendingConditionRegistry.registerSpendingCondition(
                    PAYMENT_V2_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentV2ToPaymentV2Condition.address,
                );
                await spendingConditionRegistry.registerSpendingCondition(
                    FEE_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, feeToPaymentV2Condition.address,
                );
                await spendingConditionRegistry.renounceOwnership();

                const stateVerifier = await PaymentTransactionStateTransitionVerifier.new();
                const txFinalizationVerifier = await TxFinalizationVerifier.new();

                this.paymentV2ExitGame = await PaymentExitGame.new(
                    this.framework.address,
                    config.registerKeys.vaultId.eth,
                    config.registerKeys.vaultId.erc20,
                    outputGuardHandlerRegistry.address,
                    spendingConditionRegistry.address,
                    stateVerifier.address,
                    txFinalizationVerifier.address,
                    PAYMENT_V2_TX_TYPE,
                );

                await this.framework.registerExitGame(
                    PAYMENT_V2_TX_TYPE,
                    this.paymentV2ExitGame.address,
                    config.frameworks.protocols.moreVp,
                    { from: maintainer },
                );

                this.feeExitGame = await FeeExitGame.new();
                await this.framework.registerExitGame(
                    FEE_TX_TYPE,
                    this.feeExitGame.address,
                    config.frameworks.protocols.moreVp,
                    { from: maintainer },
                );

                await time.increase(time.duration.weeks(3).add(time.duration.seconds(1)));
            });

            it('should have Payment V2 and Fee exit game registered', async () => {
                expect(await this.framework.exitGames(PAYMENT_V2_TX_TYPE)).to.equal(this.paymentV2ExitGame.address);
                expect(await this.framework.exitGames(FEE_TX_TYPE)).to.equal(this.feeExitGame.address);
            });

            describe('When operator creates and mined the first fee transaction', () => {
                let firstFeeTx;
                beforeEach(async () => {
                    const feeOutputs = [
                        new WireTransactionOutput(FEE_OUTPUT_TYPE, FEE_AMOUNT, operatorFeeAddress, ETH),
                        new FeeNonceOutput(FEE_NONCE_OUTPUT_TYPE, FEE_NONCE_1),
                    ];

                    firstFeeTx = (new FeeTransaction(FEE_TX_TYPE, [], feeOutputs)).rlpEncoded();

                    const merkleTree = new MerkleTree([firstFeeTx], MERKLE_TREE_DEPTH);
                    await this.framework.submitBlock(merkleTree.root, { from: authority });
                });

                describe('And then the operator creates a second fee transaction chained with the first one', () => {
                    let secondFeeTx;
                    let secondFeeUtxoPos;
                    let secondFeeTxMerkleProof;

                    beforeEach(async () => {
                        const feeInputs = [
                            computeNormalOutputId(web3.utils.bytesToHex(firstFeeTx), 1), // fee nonce is second output
                        ];

                        const feeOutputs = [
                            new WireTransactionOutput(FEE_OUTPUT_TYPE, FEE_AMOUNT, operatorFeeAddress, ETH),
                            new FeeNonceOutput(FEE_NONCE_OUTPUT_TYPE, FEE_NONCE_2),
                        ];

                        secondFeeTx = (new FeeTransaction(FEE_TX_TYPE, feeInputs, feeOutputs)).rlpEncoded();

                        const blockNum = (await this.framework.nextChildBlock()).toNumber();
                        const outputIndex = 0;
                        secondFeeUtxoPos = buildUtxoPos(blockNum, 0, outputIndex);

                        const merkleTree = new MerkleTree([secondFeeTx], MERKLE_TREE_DEPTH);
                        secondFeeTxMerkleProof = merkleTree.getInclusionProof(secondFeeTx);
                        await this.framework.submitBlock(merkleTree.root, { from: authority });
                    });

                    describe('And then the operator spends the second fee transaction', () => {
                        let paymentTxObj;
                        let paymentTx;
                        let paymentOutputUtxoPos;
                        let paymentTxMerkleProof;

                        beforeEach(async () => {
                            const inputs = [
                                // fee output is first output
                                computeNormalOutputId(
                                    web3.utils.bytesToHex(secondFeeTx), 0,
                                ),
                            ];
                            const outputs = [
                                new PaymentTransactionOutput(
                                    PAYMENT_V2_OUTPUT_TYPE,
                                    FEE_AMOUNT,
                                    operatorFeeAddress,
                                    ETH,
                                ),
                            ];
                            paymentTxObj = new PaymentTransaction(PAYMENT_V2_TX_TYPE, inputs, outputs);
                            paymentTx = paymentTxObj.rlpEncoded();

                            const paymentV2TxBlockNum = (await this.framework.nextChildBlock()).toNumber();
                            const outputIndex = 0;
                            paymentOutputUtxoPos = buildUtxoPos(paymentV2TxBlockNum, 0, outputIndex);

                            const merkleTree = new MerkleTree([paymentTx], MERKLE_TREE_DEPTH);
                            paymentTxMerkleProof = merkleTree.getInclusionProof(paymentTx);
                            await this.framework.submitBlock(merkleTree.root, { from: authority });
                        });

                        it('should be able to standard exit the fee via Payment transaction', async () => {
                            const args = {
                                utxoPos: paymentOutputUtxoPos,
                                rlpOutputTx: paymentTx,
                                outputType: PAYMENT_V2_OUTPUT_TYPE,
                                outputGuardPreimage: EMPTY_BYTES,
                                outputTxInclusionProof: paymentTxMerkleProof,
                            };

                            const bondSize = await this.paymentV2ExitGame.startStandardExitBondSize();
                            const tx = await this.paymentV2ExitGame.startStandardExit(
                                args, { from: operatorFeeAddress, value: bondSize },
                            );
                            await expectEvent.inLogs(
                                tx.logs,
                                'ExitStarted',
                                { owner: operatorFeeAddress },
                            );
                        });

                        it('should be able to in-flight exit the fee via Payment transaction', async () => {
                            const txHash = hashTx(paymentTxObj, this.framework.address, INPUT_SCHEMA.OUTPUT_ID);
                            const operatorSignature = sign(txHash, operatorFeeAddressPrivateKey);
                            const args = {
                                inFlightTx: paymentTx,
                                inputTxs: [secondFeeTx],
                                inputTxTypes: [FEE_TX_TYPE],
                                inputUtxosPos: [secondFeeUtxoPos],
                                outputGuardPreimagesForInputs: [EMPTY_BYTES],
                                inputTxsInclusionProofs: [secondFeeTxMerkleProof],
                                inputTxsConfirmSigs: [EMPTY_BYTES],
                                inFlightTxWitnesses: [operatorSignature],
                                inputSpendingConditionOptionalArgs: [EMPTY_BYTES],
                            };

                            const bondSize = await this.paymentV2ExitGame.startIFEBondSize();
                            const tx = await this.paymentV2ExitGame.startInFlightExit(
                                args,
                                { from: alice, value: bondSize },
                            );
                            await expectEvent.inLogs(
                                tx.logs,
                                'InFlightExitStarted',
                            );
                        });
                    });
                });
            });
        });
    });
});
