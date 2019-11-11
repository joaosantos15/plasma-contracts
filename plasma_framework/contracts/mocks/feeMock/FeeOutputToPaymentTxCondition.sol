pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../transactions/eip712Libs/PaymentEip712LibUsingOutputId.sol";

import "../../src/framework/PlasmaFramework.sol";
import "../../src/transactions/PaymentTransactionModel.sol";
import "../../src/transactions/WireTransaction.sol";
import "../../src/transactions/eip712Libs/PaymentEip712Lib.sol";
import "../../src/utils/IsDeposit.sol";
import "../../src/utils/UtxoPosLib.sol";
import "../../src/exits/interfaces/ISpendingCondition.sol";
import "../../src/exits/utils/OutputId.sol";

contract FeeOutputToPaymentTxCondition is ISpendingCondition {
    using PaymentEip712LibUsingOutputId for PaymentEip712LibUsingOutputId.Constants;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;

    uint256 public supportInputTxType;
    uint256 public supportSpendingTxType;
    IsDeposit.Predicate public isDeposit;
    PaymentEip712LibUsingOutputId.Constants internal eip712;

    /**
     * @dev This is designed to be re-useable for all versions of payment transaction, so that
     *      inputTxType and spendingTxType of the payment output is injected instead
     */
    constructor(PlasmaFramework framework, uint256 inputTxType, uint256 spendingTxType) public {
        eip712 = PaymentEip712LibUsingOutputId.initConstants(address(framework));
        supportInputTxType = inputTxType;
        supportSpendingTxType = spendingTxType;
        isDeposit = IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL());
    }

    /**
     * @dev This implementation checks signature for spending Fee output. It should be signed with the owner signature.
     *      The fee output that is spendable would be following WireTransaction Output format, thuse reusing WireTransaction here.
     * @param inputTxBytes Encoded input transaction, in bytes
     * @param outputIndex Output index of the input transaction
     * @param inputTxPos The tx position of the input tx (0 if in-flight)
     * @param spendingTxBytes Spending transaction, in bytes
     * @param inputIndex Input index of the spending tx that points to the output
     * @param signature Signature of the venue
     */
    function verify(
        bytes calldata inputTxBytes,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTxBytes,
        uint16 inputIndex,
        bytes calldata signature,
        bytes calldata /*outputGuardPreimage*/
    )
        external
        view
        returns (bool)
    {
        verifyInputTxType(inputTxBytes);

        PaymentTransactionModel.Transaction memory spendingTx = verifySpendingTxType(spendingTxBytes);

        verifySpendingTheOutput(inputTxBytes, outputIndex, spendingTx, inputIndex, inputTxPos);

        verifySignature(inputTxBytes, outputIndex, spendingTx, signature);

        return true;
    }

    function verifyInputTxType(bytes memory inputTxBytes) private view {
        uint256 txType = WireTransaction.getTransactionType(inputTxBytes);
        require(txType == supportInputTxType, "Input tx is an unsupported payment tx type");
    }

    function verifySpendingTxType(bytes memory spendingTxBytes)
        private
        view
        returns (PaymentTransactionModel.Transaction memory)
    {
        PaymentTransactionModel.Transaction memory spendingTx = PaymentTransactionModel.decode(spendingTxBytes);
        require(spendingTx.txType == supportSpendingTxType, "The spending tx is an unsupported tx type");
        return spendingTx;
    }

    function verifySpendingTheOutput(
        bytes memory inputTxBytes,
        uint16 outputIndex,
        PaymentTransactionModel.Transaction memory spendingTx,
        uint16 inputIndex,
        uint256 inputTxPos
    )
        private
        view
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.build(TxPosLib.TxPos(inputTxPos), outputIndex);
        bytes32 outputId = getOutputId(inputTxBytes, utxoPos);
        
        require(
            spendingTx.inputs[inputIndex] == outputId,
            "Spending tx points to the incorrect outputId"
        );
    }

    function verifySignature(
        bytes memory inputTxBytes,
        uint16 outputIndex,
        PaymentTransactionModel.Transaction memory spendingTx,
        bytes memory signature
    )
        private
        view
    {
        WireTransaction.Output memory output = WireTransaction.getOutput(inputTxBytes, outputIndex);
        address owner = address(uint160(output.outputGuard));
        
        require(owner == ECDSA.recover(eip712.hashTx(spendingTx), signature), "Tx in not signed correctly");
    }

    function getOutputId(bytes memory inputTxBytes, UtxoPosLib.UtxoPos memory utxoPos)
        private
        view
        returns (bytes32)
    {
        if (isDeposit.test(utxoPos.blockNum())) {
            return OutputId.computeDepositOutputId(inputTxBytes, utxoPos.outputIndex(), utxoPos.value);
        } else {
            return OutputId.computeNormalOutputId(inputTxBytes, utxoPos.outputIndex());
        }
    }
}
