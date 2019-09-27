const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentOutputGuardHandler = artifacts.require('PaymentOutputGuardHandler');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit')
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit')
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit')
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');

const { TX_TYPE, OUTPUT_TYPE, VAULT_ID } = require('./configs/types_and_ids.js');
const { PROTOCOL } = require('./configs/framework_variables.js');

module.exports = async (deployer) => {
    const plasmaFramework = await PlasmaFramework.deployed()
    const erc20Vault = await Erc20Vault.deployed()
    const ethVault = await EthVault.deployed()

    const paymentSpendingConditionRegistry = await PaymentSpendingConditionRegistry.new()
    const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

    const paymentOutputGuardHandler = await PaymentOutputGuardHandler.new(OUTPUT_TYPE.PAYMENT);
    await outputGuardHandlerRegistry.registerOutputGuardHandler(
        OUTPUT_TYPE.PAYMENT, paymentOutputGuardHandler.address,
    );

    await deployer.deploy(PaymentChallengeStandardExit)
    await deployer.deploy(PaymentProcessStandardExit)
    await deployer.deploy(PaymentStartStandardExit)

    await deployer.link(PaymentChallengeStandardExit, PaymentExitGame);
    await deployer.link(PaymentProcessStandardExit, PaymentExitGame);
    await deployer.link(PaymentStartStandardExit, PaymentExitGame);

    const paymentExitGame = await PaymentExitGame.new(
        plasmaFramework.address,
        ethVault.address,
        erc20Vault.address,
        outputGuardHandlerRegistry.address,
        paymentSpendingConditionRegistry.address
    )

    await plasmaFramework.registerExitGame(
        TX_TYPE.PAYMENT,
        paymentExitGame.address,
        PROTOCOL.MORE_VP,
        { from: global.authorityAddress },
    );
};
