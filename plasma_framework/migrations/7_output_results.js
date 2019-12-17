/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const PlasmaFramework = artifacts.require('PlasmaFramework');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const Erc20Vault = artifacts.require('Erc20Vault');
const FeeExitGame = artifacts.require('FeeExitGame');
const PaymentExitGame = artifacts.require('PaymentExitGame');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethVault = await EthVault.deployed();
    const ethDepositVerifier = await EthDepositVerifier.deployed();
    const erc20DepositVerifier = await Erc20DepositVerifier.deployed();
    const erc20Vault = await Erc20Vault.deployed();
    const feeExitGame = await FeeExitGame.deployed();
    let paymentExitGame;

    if (process.env.DEPLOYMENT_ENV !== 'production') {
        paymentExitGame = await PaymentExitGame.deployed().address;
    } else {
        paymentExitGame = '0x0';
    }

    const data = JSON.stringify({
        authority_address: `${authorityAddress}`.toLowerCase(),
        eth_vault: `${ethVault.address}`.toLowerCase(),
        eth_deposit_verifier: `${ethDepositVerifier.address}`.toLowerCase(),
        erc20_vault: `${erc20Vault.address}`.toLowerCase(),
        erc20_deposit_verifier: `${erc20DepositVerifier.address}`.toLowerCase(),
        fee_exit_game: `${feeExitGame.address}`.toLowerCase(),
        payment_exit_game: `${paymentExitGame}`.toLowerCase(),
        plasma_framework_tx_hash: `${PlasmaFramework.network.transactionHash}`.toLowerCase(),
        plasma_framework: `${plasmaFramework.address}`.toLowerCase(),
    }, undefined, 2);

    console.log(data);
    console.log(process.env.DEPLOYMENT_ENV);

    // Save to `output.json`
    const buildDir = path.resolve(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }
    fs.writeFileSync(path.resolve(buildDir, 'outputs.json'), data);
};
