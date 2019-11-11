pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/interfaces/IOutputGuardHandler.sol";
import "../../src/exits/models/OutputGuardModel.sol";
import "../../src/utils/AddressPayable.sol";

/**
 * In fact, this is 100% same as PaymentOutputGuardHandler
 */
contract FeeOutputGuardHandler is IOutputGuardHandler {
    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        require(data.preimage.length == 0, "Pre-image of the output guard should be empty");
        return true;
    }

    function getExitTarget(OutputGuardModel.Data memory data) public view returns (address payable) {
        return AddressPayable.convert(address(uint160(data.guard)));
    }

    function getConfirmSigAddress(OutputGuardModel.Data memory /*data*/)
        public
        view
        returns (address)
    {
        return address(0);
    }
}
