# AtomicAssets
AtomicAssets is a Non Fungible Token (NFT) standard for eosio blockchains developed by [pink.network](https://pink.network).

It offers a powerful feature set while keeping unnecessary complexity to a minimum and focusses on RAM efficiency.

### [Documentation can be found here.](https://github.com/pinknetworkx/atomicassets-contracts/wiki)

## Useful links
- API: https://github.com/pinknetworkx/eosio-contract-api
- Live API example: https://wax.api.atomicassets.io/atomicassets/docs/
- Javascript module: https://www.npmjs.com/package/atomicassets
- AtomicMarket (open source marketplace): https://github.com/pinknetworkx/atomicmarket-contract
- Telegram group: https://t.me/atomicassets

## Key Features

- **Powerful structure**

	NFTs are grouped by collections rather than their author, which allows for flexible authorizations. \
	Schemas give NFTs an extensible data structure, which is used for the serialization. \
	Templates store data and can be referenced by assets. This allows grouping similar assets together and saving RAM by not having to store the same data for each asset individually. Templates can also make NFTs non-transferable or non-burnable. \
	Assets always belong to a collection and a schema, and can optionally reference a template.
	
- **Data Serialization**

	AtomicAssets uses a custom built serialization inspired by Protobuf, which significantly reduces RAM costs compared to traditional methods (e.g. JSON strings). Serialization is done within the contract, which guarantees that no corrupt data enters the blockchain state.
	
- **No RAM Costs for users**

	The RAM cost is paid fully by the dapps that create the assets. Even when transfering assets, this stays the same. The maximum an end user will ever have to pay are 112 bytes for their own scope, and even that will likely only rarely be necessary.
	This also means that AtomicAssets works **without claims**. Transfers are instant and no further user action is required.
	
- **Minimal fixed RAM costs**

	Creating an asset only costs **151 bytes** (112 of which are for the necessary index). Additionally, each token owner needs to have a scope, which costs **112 bytes**. 
	
- **Notifications for Smart Contracts**

	Smart Contracts can get notified automatically about any relevant events related to their assets. This enables them to make the assets an integral part of their game rather than just a static token.
	
- **Backing assets with Fungible Tokens**

	Assets can be backed by standard fungible tokens (e.g. EOS / WAX). Those tokens can only be freed by burning the asset, thus allowing dapps to give their asset a guaranteed intrinsic value.
	
- **Powerful Trade Offers**

	AtomicAssets features a native implementation of two sided trade offers (similar to Steam or WAX Express Trade). This allows creating and accepting offers **with a single action**.
	The implementation of the offers also allows for **peer to peer marketplaces** that don't require transferring ownership to a market contract.

## Build contract

```bash
$ mkdir build
$ cdt-cpp -abigen -contract=atomicassets -I./include src/atomicassets.cpp -o build/atomicassets.wasm
```

## Testing

### Test Framework
- Uses Vert framework for EOSIO contract testing (migrated from Hydra)
- Tests written in JavaScript using Jest
- Test configuration in `jest.config.js` with 10-minute timeout

### Running Tests

```bash
$ yarn install
$ yarn test        # Run all tests
$ yarn test addconf  # Run specific test files matching pattern
```

### Test Structure
Tests are organized in directories by functionality:
- `tests/Admin Actions/` - Administrative operations
- `tests/Asset Actions/` - Asset creation and management
- `tests/Collection Actions/` - Collection management
- `tests/Schema Actions/` - Schema operations
- `tests/Template Actions/` - Template management
- `tests/Transfer-Offer Actions/` - Transfer and trading functionality
- `tests/Deposit-Withdraw-Back-Burn Actions/` - Token backing operations