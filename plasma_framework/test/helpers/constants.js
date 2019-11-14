const PROTOCOL = {
    MVP: 1,
    MORE_VP: 2,
};

const TX_TYPE = {
    PAYMENT: 1,
};

const OUTPUT_TYPE = {
    PAYMENT: 1,
};

const EMPTY_BYTES = '0x';
const EMPTY_BYTES_32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const VAULT_ID = {
    ETH: 1,
    ERC20: 2,
};

const CHILD_BLOCK_INTERVAL = 1000;

module.exports = {
    EMPTY_BYTES,
    EMPTY_BYTES_32,
    PROTOCOL,
    TX_TYPE,
    OUTPUT_TYPE,
    CHILD_BLOCK_INTERVAL,
    VAULT_ID,
};