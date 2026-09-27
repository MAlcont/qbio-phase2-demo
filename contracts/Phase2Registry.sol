// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Minimal Phase-2 registry prototype.
/// @dev Individual YES/NO intentions are deliberately NOT stored on-chain.
///      The public governance state contains only:
///        1. which side currently wins (YES or NO), and
///        2. after discussion has started, the aggregate share of voting power
///           represented by explicit intentions.
///      A dormant/absent voter is treated as NO by the off-chain projection maths.
contract Phase2Registry {
    struct Proposal {
        string documentURI;
        uint64 createdAt;
        uint64 projectionUpdatedAt;
        uint16 participationBps; // 10_000 = 100%; meaningful only after discussionStarted.
        bool exists;
        bool yesWins;            // false means NO wins; NO is also the default/tie outcome.
        bool discussionStarted;
    }

    address public dao;
    address public verifier;
    IERC20Balance public immutable qbio;
    uint256 public minQbio;

    mapping(uint256 => Proposal) public proposals;
    mapping(address => bytes32) public certificationRef;

    event ProposalPosted(uint256 indexed proposalId, string documentURI);
    event ProjectionWinnerPublished(uint256 indexed proposalId, bool yesWins);
    event DiscussionParticipationPublished(uint256 indexed proposalId, uint16 participationBps);
    event WalletCertified(address indexed wallet, bytes32 indexed verifierRef);
    event WalletCertificationRevoked(address indexed wallet);
    event VerifierChanged(address indexed verifier);
    event MinimumQbioChanged(uint256 minimum);

    modifier onlyDAO() {
        require(msg.sender == dao, "DAO_ONLY");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "VERIFIER_ONLY");
        _;
    }

    constructor(address dao_, address verifier_, address qbio_, uint256 minQbio_) {
        require(dao_ != address(0) && verifier_ != address(0) && qbio_ != address(0), "ZERO_ADDRESS");
        dao = dao_;
        verifier = verifier_;
        qbio = IERC20Balance(qbio_);
        minQbio = minQbio_;
    }

    /// @notice DAO manually promotes a Phase-1 proposal into the soft Phase-2 process.
    /// @dev A new proposal starts with NO winning because all eligible voting power is dormant/absent.
    function postProposal(uint256 proposalId, string calldata documentURI) external onlyDAO {
        require(!proposals[proposalId].exists, "PROPOSAL_EXISTS");
        proposals[proposalId] = Proposal({
            documentURI: documentURI,
            createdAt: uint64(block.timestamp),
            projectionUpdatedAt: uint64(block.timestamp),
            participationBps: 0,
            exists: true,
            yesWins: false,
            discussionStarted: false
        });
        emit ProposalPosted(proposalId, documentURI);
    }

    /// @notice Publishes only the aggregate winner. No voter address or choice is accepted by this function.
    /// @dev It can be called only when the winner changes, so a YES->NO intention change that does not
    ///      alter the aggregate winner leaves no vote-specific on-chain trace.
    function publishWinner(uint256 proposalId, bool yesWins) external onlyDAO {
        Proposal storage proposal = _proposal(proposalId);
        require(proposal.yesWins != yesWins, "WINNER_UNCHANGED");
        proposal.yesWins = yesWins;
        proposal.projectionUpdatedAt = uint64(block.timestamp);
        emit ProjectionWinnerPublished(proposalId, yesWins);
    }

    /// @notice Starts/updates the public discussion-participation disclosure.
    /// @param participationBps Explicit-intention voting power / total eligible voting power, in basis points.
    /// @dev This reveals only an aggregate percentage. It never accepts individual voter addresses or choices.
    function publishDiscussionParticipation(uint256 proposalId, uint16 participationBps) external onlyDAO {
        require(participationBps <= 10_000, "INVALID_BPS");
        Proposal storage proposal = _proposal(proposalId);
        bool firstDisclosure = !proposal.discussionStarted;
        require(firstDisclosure || proposal.participationBps != participationBps, "PARTICIPATION_UNCHANGED");
        proposal.discussionStarted = true;
        proposal.participationBps = participationBps;
        proposal.projectionUpdatedAt = uint64(block.timestamp);
        emit DiscussionParticipationPublished(proposalId, participationBps);
    }

    /// @notice Called only after the approved external identity/enrollment flow.
    /// @dev verifierRef should be a non-sensitive opaque reference/hash, never PII.
    ///      Certification is intentionally separate from per-proposal vote intention.
    function certifyWallet(address wallet, bytes32 verifierRef) external onlyVerifier {
        require(wallet != address(0), "ZERO_WALLET");
        require(verifierRef != bytes32(0), "EMPTY_REF");
        require(qbio.balanceOf(wallet) >= minQbio, "QBIO_THRESHOLD");
        certificationRef[wallet] = verifierRef;
        emit WalletCertified(wallet, verifierRef);
    }

    function revokeWallet(address wallet) external onlyVerifier {
        delete certificationRef[wallet];
        emit WalletCertificationRevoked(wallet);
    }

    function isCertified(address wallet) public view returns (bool) {
        return certificationRef[wallet] != bytes32(0);
    }

    /// @notice Token threshold check kept separate from identity certification.
    function meetsQbioThreshold(address wallet) public view returns (bool) {
        return qbio.balanceOf(wallet) >= minQbio;
    }

    function setVerifier(address newVerifier) external onlyDAO {
        require(newVerifier != address(0), "ZERO_VERIFIER");
        verifier = newVerifier;
        emit VerifierChanged(newVerifier);
    }

    function setMinimumQbio(uint256 newMinimum) external onlyDAO {
        minQbio = newMinimum;
        emit MinimumQbioChanged(newMinimum);
    }

    function _proposal(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        require(proposal.exists, "UNKNOWN_PROPOSAL");
    }
}
