# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AtomicAssets is an NFT (Non-Fungible Token) standard for EOSIO blockchains. This is a C++ smart contract that implements the AtomicAssets standard with a focus on RAM efficiency and powerful features like data serialization, backing assets with fungible tokens, and native trade offers.

## Architecture

### Core Components

- **Contract Implementation**: Main contract logic in `src/atomicassets.cpp`
- **Header Files**: Core definitions in `include/atomicassets.hpp`, data handling in `include/atomicdata.hpp`
- **Interface**: Contract interface defined in `include/atomicassets-interface.hpp`
- **Utilities**: Base58 encoding (`include/base58.hpp`) and format checking (`include/checkformat.hpp`)

### Key Concepts

- **Collections**: NFTs are grouped by collections rather than authors, allowing flexible authorizations
- **Schemas**: Define extensible data structures used for serialization
- **Templates**: Store reusable data that can be referenced by assets to save RAM
- **Assets**: Always belong to a collection and schema, optionally reference a template
- **Data Serialization**: Custom Protobuf-inspired serialization to reduce RAM costs

## Build Commands

### Building the Contract
```bash
mkdir build
cdt-cpp -abigen -contract=atomicassets -I./include src/atomicassets.cpp -o build/atomicassets.wasm
```

## Testing

### Test Framework
- Uses Vert framework for EOSIO contract testing (migrated from Hydra)
- Tests written in JavaScript using Jest
- Test configuration in `jest.config.js` with 10-minute timeout

### Running Tests
```bash
npm test        # Run all tests
jest [pattern]  # Run specific test files matching pattern
```

### Test Structure
Tests are organized in directories by functionality:
- `tests/admin-actions/` - Administrative operations
- `tests/asset-actions/` - Asset creation and management
- `tests/author-swap-actions/` - Collection author swap offers
- `tests/collection-actions/` - Collection management
- `tests/deposit-withdraw-back-burn-actions/` - Token backing operations
- `tests/interface-header/` - Interface header consumer compile check
- `tests/schema-actions/` - Schema operations
- `tests/template-actions/` - Template management
- `tests/transfer-offer-actions/` - Transfer and trading functionality

### Test Files
Each test file follows the pattern `[action].test.js` and uses Vert framework for blockchain simulation.

## Code Formatting
```bash
npm run prettier  # Format JavaScript test files
```

## Development Notes

- Contract uses EOSIO CDT (Contract Development Toolkit)
- RAM efficiency is a key design principle - assets cost only 151 bytes
- All user operations are RAM-free for end users
- Contract supports notifications to other smart contracts for game integration
- Trade offers are implemented natively for peer-to-peer marketplaces