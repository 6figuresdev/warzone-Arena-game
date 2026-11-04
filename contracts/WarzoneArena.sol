// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WarzoneArena
/// @notice Timed, winner-takes-all USDC rounds for referee-verified shooter scores.
/// @dev The referee only attests scores and cannot move funds. A dishonest referee
/// can only pick the winner among entered players. If no score is ever attested
/// and submitted, entrants refund themselves after the submission deadline.
/// Winners have seven days after that deadline to claim. If a winner remains
/// unpaid (including an unpayable USDC recipient), entrants can then refund
/// their own entry fees instead; the prize is never redirected.
/// On Arc, deploy with the six-decimal ERC-20 USDC at
/// 0x3600000000000000000000000000000000000000; fees use token base units.
contract WarzoneArena is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token used for entry fees and payouts.
    IERC20 public immutable usdc;
    /// @notice Immutable signer authorized to attest scores.
    address public immutable referee;
    /// @notice Entry fee in USDC base units (six decimals on Arc).
    uint256 public immutable entryFee;
    /// @notice Length of each round in seconds.
    uint64 public immutable roundDuration;
    /// @notice Additional score-submission time after each round ends, in seconds.
    uint64 public immutable submissionWindow;
    /// @notice Deployment timestamp, when round zero begins.
    uint256 public immutable startTime;

    /// @notice Winner claim window after the submission deadline, in seconds.
    uint64 public constant CLAIM_GRACE = 7 days;

    /// @notice EIP-712 score-attestation type hash.
    bytes32 public constant SCORE_TYPEHASH =
        keccak256("ScoreAttestation(address player,uint256 round,uint32 score)");

    struct Round {
        uint256 pot;
        uint256 entrants;
        uint32 topScore;
        address topPlayer;
        bool claimed;
    }

    struct Player {
        bool entered;
        uint32 bestScore;
        bool refunded;
    }

    struct RoundView {
        uint256 pot;
        uint256 entrants;
        uint32 topScore;
        address topPlayer;
        bool claimed;
        uint256 endsAt;
        uint256 deadline;
    }

    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => mapping(address => Player)) private _players;

    error ZeroAddress();
    error ZeroValue();
    error AlreadyEntered();
    error NotEntered();
    error FutureRound();
    error SubmissionClosed();
    error SubmissionStillOpen();
    error ZeroScore();
    error InvalidRefereeSignature();
    error NoWinner();
    error AlreadyClaimed();
    error ClaimWindowClosed();
    error WinnerExists();
    error AlreadyRefunded();

    event Entered(uint256 indexed round, address indexed player, uint256 entryFee);
    event ScoreSubmitted(uint256 indexed round, address indexed player, uint32 score);
    event Claimed(uint256 indexed round, address indexed winner, uint256 amount);
    event Refunded(uint256 indexed round, address indexed player, uint256 amount);

    /// @notice Creates an arena with immutable rules and EIP-712 domain WarzoneArena/1.
    /// @param usdc_ ERC-20 USDC contract used for every transfer.
    /// @param referee_ EOA whose signatures attest player scores.
    /// @param entryFee_ Entry fee denominated in USDC base units.
    /// @param roundDuration_ Round length in seconds.
    /// @param submissionWindow_ Submission grace period in seconds.
    constructor(
        IERC20 usdc_,
        address referee_,
        uint256 entryFee_,
        uint64 roundDuration_,
        uint64 submissionWindow_
    ) EIP712("WarzoneArena", "1") {
        if (address(usdc_) == address(0) || referee_ == address(0)) revert ZeroAddress();
        if (entryFee_ == 0 || roundDuration_ == 0 || submissionWindow_ == 0) revert ZeroValue();

        usdc = usdc_;
        referee = referee_;
        entryFee = entryFee_;
        roundDuration = roundDuration_;
        submissionWindow = submissionWindow_;
        startTime = block.timestamp;
    }

    /// @notice Returns the active zero-based round identifier.
    function currentRound() public view returns (uint256) {
        return (block.timestamp - startTime) / roundDuration;
    }

    /// @notice Returns the exclusive entry cutoff timestamp for a round.
    /// @param round Zero-based round identifier.
    function roundEndsAt(uint256 round) public view returns (uint256) {
        return startTime + (round + 1) * uint256(roundDuration);
    }

    /// @notice Returns the exclusive score cutoff and inclusive payout opening timestamp.
    /// @param round Zero-based round identifier.
    function submissionDeadline(uint256 round) public view returns (uint256) {
        return roundEndsAt(round) + uint256(submissionWindow);
    }

    /// @notice Enters the current round once, pulling the USDC fee from the caller.
    /// @dev The caller must approve this contract for at least entryFee beforehand.
    function enter() external nonReentrant {
        uint256 round = currentRound();
        Player storage player = _players[round][msg.sender];
        if (player.entered) revert AlreadyEntered();

        player.entered = true;
        Round storage roundState = _rounds[round];
        roundState.pot += entryFee;
        roundState.entrants++;

        usdc.safeTransferFrom(msg.sender, address(this), entryFee);
        emit Entered(round, msg.sender, entryFee);
    }

    /// @notice Submits a positive referee-signed score for a round the caller entered.
    /// @dev Only improvements update personal bests; tied top scores keep the earlier leader.
    /// The inherited eip712Domain() exposes the domain fields used for signatures.
    /// @param round Round covered by the attestation.
    /// @param score Verified score covered by the attestation.
    /// @param signature Referee's ECDSA signature of the EIP-712 attestation digest.
    function submitScore(uint256 round, uint32 score, bytes calldata signature) external {
        Player storage player = _players[round][msg.sender];
        if (!player.entered) revert NotEntered();
        if (round > currentRound()) revert FutureRound();
        if (block.timestamp >= submissionDeadline(round)) revert SubmissionClosed();
        if (score == 0) revert ZeroScore();

        bytes32 structHash = keccak256(abi.encode(SCORE_TYPEHASH, msg.sender, round, score));
        if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != referee) {
            revert InvalidRefereeSignature();
        }

        if (score > player.bestScore) {
            player.bestScore = score;
            Round storage roundState = _rounds[round];
            if (score > roundState.topScore) {
                roundState.topScore = score;
                roundState.topPlayer = msg.sender;
            }
        }

        emit ScoreSubmitted(round, msg.sender, score);
    }

    /// @notice Pays the entire round pot to its winner during the seven-day claim window.
    /// @dev Anyone can trigger payment; only the recorded topPlayer receives funds.
    /// Claims open at submissionDeadline(round) and close exclusively at that deadline
    /// plus CLAIM_GRACE. An unpaid winner, including an unpayable USDC recipient,
    /// leaves entrants eligible for individual entry-fee refunds after the window.
    /// @param round Round to settle.
    function claim(uint256 round) external nonReentrant {
        if (block.timestamp < submissionDeadline(round)) revert SubmissionStillOpen();
        if (block.timestamp >= submissionDeadline(round) + CLAIM_GRACE) revert ClaimWindowClosed();
        Round storage roundState = _rounds[round];
        address winner = roundState.topPlayer;
        if (winner == address(0)) revert NoWinner();
        if (roundState.claimed) revert AlreadyClaimed();

        roundState.claimed = true;
        uint256 amount = roundState.pot;
        usdc.safeTransfer(winner, amount);
        emit Claimed(round, winner, amount);
    }

    /// @notice Returns the caller's entry fee once if no winner exists or its claim window expired unpaid.
    /// @dev No-winner refunds open at the submission deadline. With an unclaimed winner,
    /// including an unpayable USDC recipient, refunds open at that deadline plus
    /// CLAIM_GRACE. Claimed rounds cannot be refunded; each entrant recovers only entryFee once.
    /// @param round Round from which to withdraw the caller's refund.
    function refund(uint256 round) external nonReentrant {
        if (block.timestamp < submissionDeadline(round)) revert SubmissionStillOpen();
        Round storage roundState = _rounds[round];
        if (roundState.claimed) revert AlreadyClaimed();
        if (roundState.topPlayer != address(0) && block.timestamp < submissionDeadline(round) + CLAIM_GRACE) {
            revert WinnerExists();
        }
        Player storage player = _players[round][msg.sender];
        if (!player.entered) revert NotEntered();
        if (player.refunded) revert AlreadyRefunded();

        player.refunded = true;
        roundState.pot -= entryFee;
        usdc.safeTransfer(msg.sender, entryFee);
        emit Refunded(round, msg.sender, entryFee);
    }

    /// @notice Returns a round's pot, entrants, leader, settlement flag and timestamps.
    /// @param round Round to inspect.
    /// @return info Round state with its entry and submission cutoffs.
    function getRound(uint256 round) external view returns (RoundView memory info) {
        Round storage roundState = _rounds[round];
        info = RoundView({
            pot: roundState.pot,
            entrants: roundState.entrants,
            topScore: roundState.topScore,
            topPlayer: roundState.topPlayer,
            claimed: roundState.claimed,
            endsAt: roundEndsAt(round),
            deadline: submissionDeadline(round)
        });
    }

    /// @notice Returns a player's entry status, best verified score and refund status.
    /// @param round Round to inspect.
    /// @param player Player address to inspect.
    /// @return entered Whether the player paid to enter the round.
    /// @return bestScore Highest accepted score for the player in the round.
    /// @return refunded Whether the player's entry fee has been refunded.
    function getPlayer(uint256 round, address player)
        external
        view
        returns (bool entered, uint32 bestScore, bool refunded)
    {
        Player storage playerState = _players[round][player];
        return (playerState.entered, playerState.bestScore, playerState.refunded);
    }
}
