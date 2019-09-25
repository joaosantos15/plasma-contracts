#!/bin/bash

sabre --mode full ../../plasma_framework/contracts/src/framework/PlasmaFramework.sol PlasmaFramework
sabre --mode full ../../plasma_framework/contracts/src/vaults/Erc20Vault.sol Erc20Vault
sabre --mode full ../../plasma_framework/contracts/src/vaults/EthVault.sol Erc20Vault
sabre --mode full ../../plasma_framework/contracts/src/vaults/verifiers/Erc20DepositVerifier.sol Erc20DepositVerifier
sabre --mode full ../../plasma_framework/contracts/src/vaults/verifiers/EthDepositVerifier.sol EthDepositVerifier
sabre --mode full ../../plasma_framework/contracts/src/exits/registries/OutputGuardHandlerRegistry.sol OutputGuardHandlerRegistry
sabre --mode full ../../plasma_framework/contracts/src/exits/payment/outputGuardHandlers/PaymentOutputGuardHandler.sol PaymentOutputGuardHandler
sabre --mode full ../../plasma_framework/contracts/src/exits/payment/spendingConditions/PaymentSpendingConditionRegistry.sol PaymentSpendingConditionRegistry
sabre --mode full ../../plasma_framework/contracts/src/exits/payment/spendingConditions/PaymentOutputToPaymentTxCondition.sol PaymentOutputToPaymentTxCondition
sabre --mode full ../../plasma_framework/contracts/src/exits/payment/PaymentExitGame.sol PaymentExitGame
