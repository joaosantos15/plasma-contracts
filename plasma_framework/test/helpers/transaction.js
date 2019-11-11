const rlp = require('rlp');
const { BN } = require('openzeppelin-test-helpers');
const { EMPTY_BYTES_32, OUTPUT_TYPE } = require('../helpers/constants.js');

const TransactionTypes = {
    PLASMA_DEPOSIT: 1,
};

class WireTransactionOutput {
    constructor(type, amount, outputGuard, token) {
        this.outputType = type;
        this.outputGuard = outputGuard;
        this.token = token;
        this.amount = amount;
    }

    formatForRlpEncoding() {
        if (this.amount instanceof BN) {
            return [this.outputType, this.outputGuard, this.token, web3.utils.numberToHex(this.amount)];
        }
        return [this.outputType, this.outputGuard, this.token, this.amount];
    }

    rlpEncoded() {
        return rlp.encode(this.formatForRlpEncoding());
    }

    static parseFromContractOutput(output) {
        const amount = parseInt(output.amount, 10);
        const outputType = parseInt(output.outputType, 10);
        return new WireTransactionOutput(outputType, amount, output.outputGuard, output.token);
    }
}

class PaymentTransactionOutput extends WireTransactionOutput {}

class WireTransaction {
    constructor(transactionType, inputs, outputs, metaData = EMPTY_BYTES_32) {
        this.transactionType = transactionType;
        this.inputs = inputs;
        this.outputs = outputs;
        this.metaData = metaData;
    }

    rlpEncoded() {
        const tx = [this.transactionType];

        tx.push(this.inputs);
        tx.push(WireTransaction.formatForRlpEncoding(this.outputs));
        tx.push(this.metaData);

        return rlp.encode(tx);
    }

    static formatForRlpEncoding(items) {
        return items.map(item => item.formatForRlpEncoding());
    }

    isDeposit() {
        return this.inputs === [];
    }
}

class PaymentTransaction extends WireTransaction {}

class PlasmaDepositTransaction extends PaymentTransaction {
    constructor(output, metaData = EMPTY_BYTES_32) {
        super(TransactionTypes.PLASMA_DEPOSIT, [], [output], metaData);
    }
}

/**
 * Fee Nonce Output is the output data structure that would be holding a nonce
 * for Fee transaction. This nonce is to make sure the fee transaction would be unique
 * to avoid some issue such as replay attack or colliding on id schemas.
 */
class FeeNonceOutput {
    constructor(type, nonce) {
        this.outputType = type;
        this.nonce = nonce;
    }

    formatForRlpEncoding() {
        return [this.outputType, this.nonce];
    }

    rlpEncoded() {
        return rlp.encode(this.formatForRlpEncoding());
    }
}

/**
 * Fee Transaction is not really following the full rule of WireTransaction.
 * It would have two output data structure:
 * 1. WireTransactionOutput
 * 2. FeeNonceOutput
 */
class FeeTransaction extends WireTransaction {}

module.exports = {
    PaymentTransaction,
    PlasmaDepositTransaction,
    PaymentTransactionOutput,
    WireTransaction,
    WireTransactionOutput,
    FeeNonceOutput,
    FeeTransaction,
};
