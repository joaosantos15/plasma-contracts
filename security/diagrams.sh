#!/bin/bash
cd "$(dirname "$0")"

surya graph ../plasma_framework/contracts/src/vaults/Erc20Vault.sol ../plasma_framework/contracts/src/vaults/Vault.sol ../plasma_framework/node_modules/openzeppelin-solidity/contracts/token/ERC20/IERC20.sol | dot -Tpng  > diagrams/Erc20Vault.png
surya graph ../plasma_framework/contracts/src/vaults/verifiers/Erc20DepositVerifier.sol ../plasma_framework/contracts/src/transactions/PaymentTransactionModel.sol ../plasma_framework/contracts/src/transactions/outputs/PaymentOutputModel.sol | dot -Tpng > diagrams/Erc20DepositVerifier.png 

surya graph ../plasma_framework/contracts/src/vaults/EthVault.sol ../plasma_framework/contracts/src/vaults/Vault.sol | dot -Tpng > diagrams/EthVault.png 
surya graph ../plasma_framework/contracts/src/vaults/verifiers/EthDepositVerifier.sol ../plasma_framework/contracts/src/transactions/PaymentTransactionModel.sol ../plasma_framework/contracts/src/transactions/outputs/PaymentOutputModel.sol | dot -Tpng > diagrams/EthDepositVerifier.png 

surya graph ../plasma_framework/contracts/src/framework/PlasmaFramework.sol ../plasma_framework/contracts/src/framework/BlockController.sol ../plasma_framework/contracts/src/framework/ExitGameController.sol ../plasma_framework/contracts/src/framework/registries/ExitGameRegistry.sol ../plasma_framework/contracts/src/framework/registries/VaultRegistry.sol ../plasma_framework/contracts/src/framework/utils/Operated.sol | dot -Tpng > diagrams/PlasmaFramework.png 
surya graph ../plasma_framework/contracts/src/framework/utils/PriorityQueue.sol  | dot -Tpng > diagrams/PriorityQueue.png

surya graph ../plasma_framework/contracts/src/exits/payment/PaymentExitGame.sol ../plasma_framework/contracts/src/exits/payment/routers/PaymentInFlightExitRouter.sol ../plasma_framework/contracts/src/exits/payment/routers/PaymentStandardExitRouter.sol | dot -Tpng > diagrams/PaymentExitGame.png                                                                                   
surya graph ../plasma_framework/contracts/src/exits/registries/SpendingConditionRegistry.sol ../plasma_framework/node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol | dot -Tpng > diagrams/SpendingConditionRegistry.png
surya graph ../plasma_framework/contracts/src/exits/registries/OutputGuardHandlerRegistry.sol ../plasma_framework/node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol | dot -Tpng > diagrams/OutputGuardHandlerRegistry.png
surya graph ../plasma_framework/contracts/src/exits/payment/PaymentTransactionStateTransitionVerifier.sol | dot -Tpng > diagrams/PaymentTransactionStateTransitionVerifier.png