import itertools
import os

import pytest
from eth_keys.datatypes import PrivateKey
from solc_simple import Builder
from solcx import link_code
from web3 import Web3, HTTPProvider
from web3.main import get_default_modules
from xprocess import ProcessStarter

from plasma_core.account import EthereumAccount
from plasma_core.utils.deployer import Deployer
from testlang.testlang import TestingLanguage
from tests.conveniece_wrappers import ConvenienceContractWrapper, AutominingEth

EXIT_PERIOD = 4 * 60  # 4 minutes

GAS_LIMIT = 10000000
START_GAS = GAS_LIMIT - 1000000

HUNDRED_ETH = 100 * 10 ** 18


# IMPORTANT NOTICE
# Whenever we pass to or receive from web3 an address, we do it in checksum format.
# On the other hand, in plasma (transactions, blocks, etc.) we should pass addresses in binary form (canonical address).


# Compile contracts before testing
OWN_DIR = os.path.dirname(os.path.realpath(__file__))
CONTRACTS_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../plasma_framework/contracts')))
OUTPUT_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../build')))
builder = Builder(CONTRACTS_DIR, OUTPUT_DIR)
builder.compile_all(allow_paths="*,",
                    import_remappings=["openzeppelin-solidity=/Users/piotr/Developer/OmiseGO/openzeppelin-solidity"])
deployer = Deployer(builder)


@pytest.fixture(scope="session")
def accounts():
    _accounts = []
    for i in range(1, 11):
        pk = PrivateKey(i.to_bytes(32, byteorder='big'))
        _accounts.append(EthereumAccount(pk.public_key.to_checksum_address(), pk))
    return _accounts


def ganache_initial_accounts_args(accounts):
    return [f"--account=\"{acc.key.to_hex()},{HUNDRED_ETH}\"" for acc in accounts]


def parse_worker_no(worker_id):
    worker_no = 0
    try:
        worker_no = int(worker_id[2:])
    except ValueError:
        pass



@pytest.fixture(scope="session")
def ganache_port(worker_id):
    default_port = 8545
    worker_no = parse_worker_no(worker_id)
    print(f'{worker_id}, {worker_no}')
    return default_port + worker_no


def ganache_cli(accounts, port):
    accounts_args = ganache_initial_accounts_args(accounts)

    class Starter(ProcessStarter):
        pattern = "Listening on .*"
        args = ["ganache-cli",
                f"--port={port}",
                f"--gasLimit={GAS_LIMIT}",
                f"--time=0",
                f"--blockTime=0",
                ] + accounts_args

        def filter_lines(self, lines):
            return itertools.islice(lines, 100)

    return Starter


@pytest.fixture(scope="session")
def _w3_session(xprocess, accounts, ganache_port):

    web3_modules = get_default_modules()
    web3_modules.update(eth=(AutominingEth,))

    _w3 = Web3(HTTPProvider(endpoint_uri=f'http://localhost:{ganache_port}'), modules=web3_modules)
    if not _w3.isConnected():  # try to connect to an external ganache
        xprocess.ensure(f'GANACHE_{ganache_port}', ganache_cli(accounts, ganache_port))
        assert _w3.provider.make_request('miner_stop', [])['result']

    _w3.eth.defaultAccount = _w3.eth.accounts[0]

    yield _w3

    xprocess.getinfo(f'GANACHE_{ganache_port}').terminate()


@pytest.fixture
def w3(_w3_session):
    yield _w3_session
    _w3_session.eth.enable_auto_mine()


@pytest.fixture
def get_contract(w3, accounts):
    def create_contract(path, args=(), sender=accounts[0], libraries=None):
        if libraries is None:
            libraries = dict()
        abi, hexcode = deployer.builder.get_contract_data(path)

        libraries = _encode_libs(libraries)
        linked_hexcode = link_code(hexcode, libraries)
        factory = w3.eth.contract(abi=abi, bytecode=linked_hexcode)
        tx_hash = factory.constructor(*args).transact({'gas': START_GAS, 'from': sender.address})
        tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
        contract = w3.eth.contract(abi=abi, address=tx_receipt.contractAddress)
        return ConvenienceContractWrapper(contract)

    return create_contract


@pytest.fixture
def root_chain(get_contract):
    return initialized_contract(get_contract, EXIT_PERIOD)


def initialized_contract(get_contract, exit_period):
    pql = get_contract('PriorityQueueLib')
    pqf = get_contract('PriorityQueueFactory', libraries={'PriorityQueueLib': pql.address})
    contract = get_contract('RootChain', libraries={'PriorityQueueFactory': pqf.address})
    contract.init(exit_period)
    return contract


@pytest.fixture
def token(get_contract):
    return get_contract('MintableToken')


@pytest.fixture
def testlang(root_chain, w3, accounts):
    return TestingLanguage(root_chain, w3, accounts)


@pytest.fixture
def root_chain_short_exit_period(get_contract):
    # Minimal valid exit period is 2, if we exit period to less than 2
    # we will be dividing by zero in function`RootChain::_firstPhaseNotOver`.
    # But, if we set exit period to 2, then we will automatically end up in the second phase as
    # blocks are mined with 1 second interval.
    exit_period = 4
    return initialized_contract(get_contract, exit_period)


@pytest.fixture
def testlang_root_chain_short_exit_period(root_chain_short_exit_period, w3, accounts):
    return TestingLanguage(root_chain_short_exit_period, w3, accounts)


@pytest.fixture
def utxo(testlang):
    return testlang.create_utxo()


def _encode_libs(libraries):
    return {
        libname + '.sol' + ':' + libname: libaddress
        for libname, libaddress in libraries.items()
    }


def assert_event(event_obj, expected_event_name, expected_event_args=None):
    if expected_event_args is None:
        expected_event_args = {}

    assert event_obj['event'] == expected_event_name
    assert expected_event_args.items() <= event_obj['args'].items()
