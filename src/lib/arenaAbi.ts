export const arenaAbi = [
 {
  "type": "constructor",
  "inputs": [
   {
    "name": "usdc_",
    "type": "address",
    "internalType": "contract IERC20"
   },
   {
    "name": "referee_",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "entryFee_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "roundDuration_",
    "type": "uint64",
    "internalType": "uint64"
   },
   {
    "name": "submissionWindow_",
    "type": "uint64",
    "internalType": "uint64"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "CLAIM_GRACE",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint64",
    "internalType": "uint64"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "SCORE_TYPEHASH",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "claim",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "currentRound",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "eip712Domain",
  "inputs": [],
  "outputs": [
   {
    "name": "fields",
    "type": "bytes1",
    "internalType": "bytes1"
   },
   {
    "name": "name",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "version",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "chainId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "verifyingContract",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "salt",
    "type": "bytes32",
    "internalType": "bytes32"
   },
   {
    "name": "extensions",
    "type": "uint256[]",
    "internalType": "uint256[]"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "enter",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "entryFee",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "getPlayer",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "player",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "entered",
    "type": "bool",
    "internalType": "bool"
   },
   {
    "name": "bestScore",
    "type": "uint32",
    "internalType": "uint32"
   },
   {
    "name": "refunded",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "getRound",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "info",
    "type": "tuple",
    "internalType": "struct WarzoneArena.RoundView",
    "components": [
     {
      "name": "pot",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "entrants",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "topScore",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "topPlayer",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "claimed",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "endsAt",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "deadline",
      "type": "uint256",
      "internalType": "uint256"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "referee",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "refund",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "roundDuration",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint64",
    "internalType": "uint64"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "roundEndsAt",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "startTime",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "submissionDeadline",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "submissionWindow",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint64",
    "internalType": "uint64"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "submitScore",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "score",
    "type": "uint32",
    "internalType": "uint32"
   },
   {
    "name": "signature",
    "type": "bytes",
    "internalType": "bytes"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "usdc",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IERC20"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "event",
  "name": "Claimed",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "winner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "EIP712DomainChanged",
  "inputs": [],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Entered",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "player",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "entryFee",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Refunded",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "player",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ScoreSubmitted",
  "inputs": [
   {
    "name": "round",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "player",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "score",
    "type": "uint32",
    "indexed": false,
    "internalType": "uint32"
   }
  ],
  "anonymous": false
 },
 {
  "type": "error",
  "name": "AlreadyClaimed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "AlreadyEntered",
  "inputs": []
 },
 {
  "type": "error",
  "name": "AlreadyRefunded",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ClaimWindowClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ECDSAInvalidSignature",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ECDSAInvalidSignatureLength",
  "inputs": [
   {
    "name": "length",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ECDSAInvalidSignatureS",
  "inputs": [
   {
    "name": "s",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ]
 },
 {
  "type": "error",
  "name": "FutureRound",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InvalidRefereeSignature",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InvalidShortString",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NoWinner",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotEntered",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ReentrancyGuardReentrantCall",
  "inputs": []
 },
 {
  "type": "error",
  "name": "SafeERC20FailedOperation",
  "inputs": [
   {
    "name": "token",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "StringTooLong",
  "inputs": [
   {
    "name": "str",
    "type": "string",
    "internalType": "string"
   }
  ]
 },
 {
  "type": "error",
  "name": "SubmissionClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "SubmissionStillOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "WinnerExists",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroAddress",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroScore",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroValue",
  "inputs": []
 }
] as const
