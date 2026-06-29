#include <atomicassets.hpp>


/**
*  Initializes the config table. Only needs to be called once when first deploying the contract
*  @required_auth The contract itself
*/
ACTION atomicassets::init() {
    require_auth(get_self());
    get_config().get_or_create(get_self(), config_s{});
    get_tokenconfigs().get_or_create(get_self(), tokenconfigs_s{});
}

/**
*  Adds one or more lines to the format that is used for collection data serialization
*  @required_auth The contract itself
*/
ACTION atomicassets::admincoledit(vector <atomicdata::FORMAT> collection_format_extension) {
    require_auth(get_self());

    check(collection_format_extension.size() != 0, "Need to add at least one new line");

    auto config = get_config();
    config_s current_config = config.get();

    current_config.collection_format.insert(
        current_config.collection_format.end(),
        collection_format_extension.begin(),
        collection_format_extension.end()
    );
    check_format(current_config.collection_format);

    config.set(current_config, get_self());
}


/**
*  Sets the version for the tokenconfigs table
*  @required_auth The contract itself
*/
ACTION atomicassets::setversion(string new_version) {
    require_auth(get_self());

    auto tokenconfigs = get_tokenconfigs();
    tokenconfigs_s current_tokenconfigs = tokenconfigs.get();
    current_tokenconfigs.version = new_version;

    tokenconfigs.set(current_tokenconfigs, get_self());
}


/**
*  Adds a token that can then be backed to assets
*  @required_auth The contract itself
*/
ACTION atomicassets::addconftoken(name token_contract, symbol token_symbol) {
    require_auth(get_self());

    auto config = get_config();
    config_s current_config = config.get();
    for (extended_symbol token : current_config.supported_tokens) {
        check(token.get_symbol() != token_symbol,
            "A token with this symbol is already supported");
    }

    current_config.supported_tokens.push_back(extended_symbol(token_symbol, token_contract));

    config.set(current_config, get_self());
}


/**
*  Transfers one or more assets to another account
*  @required_auth The from account
*/
ACTION atomicassets::transfer(
    name from,
    name to,
    vector <uint64_t> asset_ids,
    string memo
) {
    require_auth(from);
    require_recipient(from);
    require_recipient(to);
    internal_transfer(from, to, asset_ids, memo, from);
}

/**
*  Sets the single account authorized to open/manage non-custodial rental leases
*  (leasestart / leaseextend). name("") disables leasing entirely. Stored in its
*  own `rentalcfg` singleton so it needs no migration of the existing config row.
*  @required_auth The contract itself
*/
ACTION atomicassets::setrentmkt(name rental_market) {
    require_auth(get_self());

    check(rental_market == name("") || is_account(rental_market),
        "rental_market account does not exist");

    get_rentalcfg().set(rentalcfg_s{rental_market}, get_self());
}


/**
*  Opens a non-custodial rental lease: makes `renter` the real AtomicAssets owner
*  of the asset and parks the lister's reclaim right in the lease record, with NO
*  unlocked window (the lease row is written before the ownership flip). The
*  configured rental market is trusted to have verified the lister's consent (on
*  AtomicMarket the lister's announcerent carries that authorization).
*  @required_auth market (must be the configured rental_market)
*/
ACTION atomicassets::leasestart(
    name market,
    name title_owner,
    name renter,
    uint64_t asset_id,
    uint32_t rental_end,
    string memo
) {
    check_rental_market(market);

    check(is_account(renter), "renter account does not exist");
    check(renter != title_owner, "renter and title_owner cannot be the same");

    uint32_t now = eosio::current_time_point().sec_since_epoch();
    check(rental_end > now, "rental_end must be in the future");

    leases_t leases = get_leases();
    check(leases.find(asset_id) == leases.end(), "Asset is already leased");

    assets_t owner_assets = get_assets(title_owner);
    auto asset_itr = owner_assets.require_find(asset_id,
        "title_owner does not own this asset");
    name collection_name = asset_itr->collection_name;

    // A non-transferable asset can never be leased out (fail early with a clear
    // message; internal_transfer would otherwise reject it after the row write).
    if (asset_itr->template_id >= 0) {
        templates_t collection_templates = get_templates(asset_itr->collection_name);
        auto template_itr = collection_templates.find(asset_itr->template_id);
        check(template_itr->transferable, "The asset is not transferable");
    }

    // Write the lock row FIRST so there is no instant where the asset is
    // renter-owned but unlocked.
    leases.emplace(market, [&](auto &_lease) {
        _lease.asset_id    = asset_id;
        _lease.title_owner = title_owner;
        _lease.renter      = renter;
        _lease.rental_end  = rental_end;
        _lease.market      = market;
    });

    // Flip ownership lister -> renter under the contract's own authority. The
    // lock is already in force, so this is the privileged (enforce_lock=false)
    // path. The contract pays any transient scope RAM. A pre-existing offer that
    // references the asset is intentionally left in place: it cannot settle while
    // the asset is locked, and becomes valid again once the asset is reclaimed.
    internal_transfer(title_owner, renter, vector<uint64_t>{asset_id}, memo, get_self(), false);

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("loglock"),
        make_tuple(collection_name, asset_id, title_owner, renter, rental_end, market)
    ).send();
}


/**
*  Extends an active lease's end time. Does not change ownership.
*  @required_auth market (must be the configured rental_market)
*/
ACTION atomicassets::leaseextend(
    name market,
    uint64_t asset_id,
    uint32_t rental_end
) {
    check_rental_market(market);

    leases_t leases = get_leases();
    auto lease_itr = leases.require_find(asset_id, "Asset is not leased");
    check(rental_end > lease_itr->rental_end, "rental_end must be later than the current end");

    name title_owner = lease_itr->title_owner;
    name renter = lease_itr->renter;

    assets_t renter_assets = get_assets(renter);
    auto asset_itr = renter_assets.require_find(asset_id, "renter no longer owns the asset");
    name collection_name = asset_itr->collection_name;

    leases.modify(lease_itr, market, [&](auto &_lease) {
        _lease.rental_end = rental_end;
    });

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("loglock"),
        make_tuple(collection_name, asset_id, title_owner, renter, rental_end, market)
    ).send();
}


/**
*  Permissionless reclaim of an expired lease: returns ownership from the renter
*  to the title_owner and clears the lock. Callable by anyone once the lease has
*  expired; the renter's signature is never required (the move runs under the
*  contract's own authority). This is the guaranteed revert the whole model rests
*  on.
*  @required_auth none (permissionless)
*/
ACTION atomicassets::reclaim(
    uint64_t asset_id
) {
    leases_t leases = get_leases();
    auto lease_itr = leases.require_find(asset_id, "Asset is not leased");

    uint32_t now = eosio::current_time_point().sec_since_epoch();
    check(now >= lease_itr->rental_end, "Lease has not expired yet");

    name title_owner = lease_itr->title_owner;
    name renter = lease_itr->renter;

    assets_t renter_assets = get_assets(renter);
    auto asset_itr = renter_assets.require_find(asset_id, "renter no longer owns the asset");
    name collection_name = asset_itr->collection_name;

    // Erase the lock, then move the asset back under the contract's own authority
    // (enforce_lock=false). The contract pays any transient scope RAM so reclaim
    // never needs the title_owner's or renter's signature. A pre-existing offer
    // referencing the asset is left in place (it could not settle while locked,
    // and becomes valid again now that the asset is back with its owner).
    leases.erase(lease_itr);
    internal_transfer(renter, title_owner, vector<uint64_t>{asset_id}, "lease reclaim", get_self(), false);

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logreclaim"),
        make_tuple(collection_name, asset_id, title_owner, renter)
    ).send();
}

/**
*  Creates a new collection
*/
ACTION atomicassets::createcol(
    name author,
    name collection_name,
    bool allow_notify,
    vector <name> authorized_accounts,
    vector <name> notify_accounts,
    double market_fee,
    ATTRIBUTE_MAP data
) {
    require_auth(author);
    
    collections_t collections = get_collections();

    name collection_name_suffix = collection_name.suffix();

    if (is_account(collection_name)) {
        check(has_auth(collection_name),
            "When the collection has the name of an existing account, its authorization is required");
    } else {
        if (collection_name_suffix != collection_name) {
            check(has_auth(collection_name_suffix),
                "When the collection name has a suffix, the suffix authorization is required");
        } else {
            check(collection_name.length() == 12,
                "Without special authorization, collection names must be 12 characters long");
        }
    }

    check(collections.find(collection_name.value) == collections.end(),
        "A collection with this name already exists");

    check(allow_notify || notify_accounts.size() == 0, "Can't add notify_accounts if allow_notify is false");

    // createcol writes both vectors verbatim; cap them at 24 like addcolauth/addnotifyacc, and
    // before the loops below so an oversized vector fails fast. The cap keeps partial_read_collection
    // within its read budget.
    check(authorized_accounts.size() <= 24, "Can only have up to 24 authorized accounts");
    check(notify_accounts.size() <= 24, "Can only have up to 24 notify accounts");

    for (auto itr = authorized_accounts.begin(); itr != authorized_accounts.end(); itr++) {
        check(is_account(*itr), string("At least one account does not exist - " + itr->to_string()).c_str());
        check(std::find(authorized_accounts.begin(), authorized_accounts.end(), *itr) == itr,
            "You can't have duplicates in the authorized_accounts");
    }
    for (auto itr = notify_accounts.begin(); itr != notify_accounts.end(); itr++) {
        check(is_account(*itr), string("At least one account does not exist - " + itr->to_string()).c_str());
        check(std::find(notify_accounts.begin(), notify_accounts.end(), *itr) == itr,
            "You can't have duplicates in the notify_accounts");
    }

    check(0 <= market_fee && market_fee <= MAX_MARKET_FEE,
        "The market_fee must be between 0 and " + to_string(MAX_MARKET_FEE));

    check_name_length(data);

    auto config = get_config();
    config_s current_config = config.get();

    collections.emplace(author, [&](auto &_collection) {
        _collection.collection_name = collection_name;
        _collection.author = author;
        _collection.allow_notify = allow_notify;
        _collection.authorized_accounts = authorized_accounts;
        _collection.notify_accounts = notify_accounts;
        _collection.market_fee = market_fee;
        _collection.serialized_data = serialize(data, current_config.collection_format);
    });
}


/**
*  Sets the collection data, which is then serialized with the collection format set in the config
*  This data is used by 3rd party apps and sites to display additional information about the collection
*  Uses get_self() scope for interacting with smart contracts
*  @required_auth The collection author
*/
ACTION atomicassets::setcoldata(
    name collection_name,
    ATTRIBUTE_MAP data
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);

    check_name_length(data);

    auto config = get_config();
    config_s current_config = config.get();

    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.serialized_data = serialize(data, current_config.collection_format);
    });
}


/**
*  Adds an account to the authorized_accounts list of a collection
*  This will allow the account to create and edit both templates and assets that belong to this collection
*  Limit of 24 authorized accounts to allow low level reading of collections row for CPU optimizations
*  @required_atuh The collection author
*/

ACTION atomicassets::addcolauth(
    name collection_name,
    name account_to_add
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);

    check(is_account(account_to_add), "The account does not exist");

    vector <name> authorized_accounts = collection_itr->authorized_accounts;
    check(std::find(authorized_accounts.begin(), authorized_accounts.end(), account_to_add) ==
          authorized_accounts.end(),
        "The account is already an authorized account");

    authorized_accounts.push_back(account_to_add);

    check(authorized_accounts.size() <= 24, "Can only have up to 24 authorized accounts");
    
    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.authorized_accounts = authorized_accounts;
    });
}


/**
*  Removes an account from the authorized_accounts list of a collection
*  @required_auth The collection author
*/
ACTION atomicassets::remcolauth(
    name collection_name,
    name account_to_remove
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);
    vector <name> authorized_accounts = collection_itr->authorized_accounts;

    auto account_itr = std::find(authorized_accounts.begin(), authorized_accounts.end(), account_to_remove);

    check(account_itr != authorized_accounts.end(),
        "The account is not an authorized account");
    authorized_accounts.erase(account_itr);

    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.authorized_accounts = authorized_accounts;
    });
}


/**
*  Adds an account to the notify_accounts list of a collection
*  This will make the account get notified on every relevant action concerning this collection using require_recipient()
*  NOTE: It will consequently allow the account to make any of these actions throw (fail).
*        Only add trusted accounts to this list
*  Limit of 24 notify accounts to allow low level reading of collections row for CPU optimizations
*  @required_atuh The collection author
*/
ACTION atomicassets::addnotifyacc(
    name collection_name,
    name account_to_add
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);

    check(collection_itr->allow_notify, "Adding notify accounts to this collection is not allowed");

    check(is_account(account_to_add), "The account does not exist");

    vector <name> notify_accounts = collection_itr->notify_accounts;

    check(std::find(notify_accounts.begin(), notify_accounts.end(), account_to_add) == notify_accounts.end(),
        "The account is already a notify account");

    notify_accounts.push_back(account_to_add);

    check(notify_accounts.size() <= 24, "Can only have up to 24 notify accounts");

    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.notify_accounts = notify_accounts;
    });
}


/**
*  Removes an account from the notify_accounts list of a collection
*  @required_auth The collection author
*/
ACTION atomicassets::remnotifyacc(
    name collection_name,
    name account_to_remove
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);
    vector <name> notify_accounts = collection_itr->notify_accounts;

    auto account_itr = std::find(notify_accounts.begin(), notify_accounts.end(), account_to_remove);

    check(account_itr != notify_accounts.end(),
        "The account is not a notify account");
    notify_accounts.erase(account_itr);

    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.notify_accounts = notify_accounts;
    });
}


/**
* Sets (changes) the market fee for an existing collection
* @required_auth The collection author
*/
ACTION atomicassets::setmarketfee(
    name collection_name,
    double market_fee
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);

    check(0 <= market_fee && market_fee <= MAX_MARKET_FEE,
        "The market_fee must be between 0 and " + to_string(MAX_MARKET_FEE));

    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.market_fee = market_fee;
    });
}


/**
* Sets allow_notify to false for a collection where it has previously been true
* The collection's notify_accounts list must be empty
* @required_auth The collection author
*/
ACTION atomicassets::forbidnotify(
    name collection_name
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    require_auth(collection_itr->author);

    check(collection_itr->notify_accounts.size() == 0, "The collection's notify_accounts vector must be empty");

    check(collection_itr->allow_notify, "allow_notify is already false for this collection");

    collections.modify(collection_itr, same_payer, [&](auto &_collection) {
        _collection.allow_notify = false;
    });
}

/**
* Creates a swap offer for a collection
* Acceptance functionality depends on the authorization being 'owner' or 'active' (7 days gate)
*/

ACTION atomicassets::createauswap(
    name collection_name,
    name new_author,
    bool owner
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    if (owner){
        require_auth(permission_level{collection_itr->author, name("owner")});
    } else {
        require_auth(collection_itr->author);
    }

    author_swaps_t authorswaps = get_author_swaps();
    check(authorswaps.find(collection_name.value) == authorswaps.end(), 
        "Can't swap author's while an authorswap is underway for this collection");

    authorswaps.emplace(collection_itr->author, [&](auto &_author_swaps) {
        _author_swaps.collection_name = collection_name;
        _author_swaps.current_author = collection_itr->author;
        _author_swaps.new_author = new_author;
        _author_swaps.acceptance_date = eosio::current_time_point().sec_since_epoch() + (owner ? 0 : AUTHOR_SWAP_TIME_DELTA);
    });
}

/**
* Accepts an author swap, with time constraints based on 'owner' or 'active' permissions used when creating the author swap
* With default parameters, author swaps created by 'active' permissions can only be accepted after 1 week has passed
* With default parameters, author swaps remain valid for up to 3 weeks
*/

ACTION atomicassets::acceptauswap(
    name collection_name
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    author_swaps_t authorswaps = get_author_swaps();
    auto author_swaps_itr = authorswaps.require_find(collection_name.value,
        "No author swaps for this collection found");

    // Just in case**
    check(collection_itr->author == author_swaps_itr->current_author, 
        "Current author mismatch");

    require_auth(author_swaps_itr->new_author);

    uint32_t now = eosio::current_time_point().sec_since_epoch();

    check (now > author_swaps_itr->acceptance_date, 
        ("[ " + to_string(author_swaps_itr->acceptance_date - now) + " ] seconds remaining until this author swap can be accepted").c_str());

    check (now < author_swaps_itr->acceptance_date + AUTHOR_SWAP_TIME_DELTA, "Author swap for this collection has expired");

    collections.modify(collection_itr, author_swaps_itr->new_author, [&](auto &_collection){
        _collection.author = author_swaps_itr->new_author;
    });

    authorswaps.erase(author_swaps_itr);
}

/**
* Rejects author swaps
* Can be used by either the current author or by the new author
*/

ACTION atomicassets::rejectauswap(
    name collection_name
) {
    collections_t collections = get_collections();
    auto collection_itr = collections.require_find(collection_name.value, COLLECTION_NOT_FOUND);

    author_swaps_t authorswaps = get_author_swaps();
    auto author_swaps_itr = authorswaps.require_find(collection_name.value,
        "No author swaps for this collection found");

    // Just in case**
    check(collection_itr->author == author_swaps_itr->current_author, 
        "Current author mismatch");

    check(has_auth(author_swaps_itr->current_author) || has_auth(author_swaps_itr->new_author), 
        "Missing required authorizations");

    authorswaps.erase(author_swaps_itr);
}

/**
*  Creates a new schema
*  schemas can only be extended in the future, but never changed retroactively.
*  This guarantees a correct deserialization for existing templates and assets.
*  @required_auth authorized_creator, who is within the authorized_accounts list of the collection
*/
ACTION atomicassets::createschema(
    name authorized_creator,
    name collection_name,
    name schema_name,
    vector <FORMAT> schema_format
) {
    check_has_collection_auth(
        authorized_creator,
        collection_name
    );

    schemas_t collection_schemas = get_schemas(collection_name);

    check(1 <= schema_name.length() && schema_name.length() <= 12,
        "Schema names must be between 1 and 12 characters long");

    check(collection_schemas.find(schema_name.value) == collection_schemas.end(),
        "A schema with this name already exists for this collection");

    check_format(schema_format);

    collection_schemas.emplace(authorized_creator, [&](auto &_schema) {
        _schema.schema_name = schema_name;
        _schema.format = schema_format;
    });
}


/**
*  Adds one or more lines to the format of an existing schema
*  @required_auth authorized_editor, who is within the authorized_accounts list of the collection
*/
ACTION atomicassets::extendschema(
    name authorized_editor,
    name collection_name,
    name schema_name,
    vector <FORMAT> schema_format_extension
) {
    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    check(schema_format_extension.size() != 0, "Need to add at least one new line");

    schemas_t collection_schemas = get_schemas(collection_name);
    auto schema_itr = collection_schemas.require_find(schema_name.value,
        "No schema with this name exists for this collection");

    vector <FORMAT> lines = schema_itr->format;
    lines.insert(lines.end(), schema_format_extension.begin(), schema_format_extension.end());
    check_format(lines);

    collection_schemas.modify(schema_itr, authorized_editor, [&](auto &_schema) {
        _schema.format = lines;
    });
}

/**
*  Emplaces or modifies a schematype for a schema
*  Can be used as a descriptor of a schema's attributes (i.e. "Rarity"::"Provides X bonuses to this NFT")
*  Can also be used as a media type for a schema attribute (i.e. denoting an IPFS hash with a particular file type, like .obj or .gltf for 3D files)
*  @required_auth authorized_editor, who is within the authorized_accounts list of the collection
*/
ACTION atomicassets::setschematyp(
    name authorized_editor,
    name collection_name,
    name schema_name,
    vector <FORMAT_TYPE> schema_format_type
) {
    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    schemas_t collection_schemas = get_schemas(collection_name);
    auto schema_itr = collection_schemas.require_find(schema_name.value,
        "Schema name not found within the collection");

    schema_types_t collection_schema_types = get_schema_types(collection_name);
    auto schema_types_itr = collection_schema_types.find(schema_name.value);

    auto & schema_format = schema_itr->format;

    // Check to see if all elements in schema_format_type have unique names && exist within the schema_format
    std::set<std::string> format_type_set;
    for (FORMAT_TYPE & format_type_itr : schema_format_type){
        check(format_type_set.find(format_type_itr.name) == format_type_set.end(), 
            "Schema format type cannot contain duplicate entries");

        check(std::find_if(
                schema_format.begin(), schema_format.end(), 
                    [&format_type_itr](auto & format_itr) 
                        { return format_type_itr.name == format_itr.name; })
            != schema_format.end(), 
                ("No attribute in the Schema format matches the Schema format type of '" + format_type_itr.name + "'").c_str());

        format_type_set.insert(format_type_itr.name);
    }

    if (schema_types_itr == collection_schema_types.end()){
        collection_schema_types.emplace(authorized_editor, [&](auto &_schema_types) {
            _schema_types.schema_name = schema_name;
            _schema_types.format_type = schema_format_type;
        });
    } else {
        collection_schema_types.modify(schema_types_itr, authorized_editor, [&](auto &_schema_types) {
            _schema_types.format_type = schema_format_type;
        });
    }
}

/**
*  Creates a new template
*  @required_auth authorized_creator, who is within the authorized_accounts list of the collection
*/
ACTION atomicassets::createtempl(
    name authorized_creator,
    name collection_name,
    name schema_name,
    bool transferable,
    bool burnable,
    uint32_t max_supply,
    ATTRIBUTE_MAP immutable_data
) {
    internal_create_template(authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data);
}

/**
*  Creates a new template with explicit mutable data fields
*  @required_auth authorized_creator, who is within the authorized_accounts list of the collection
*/

ACTION atomicassets::createtempl2(
    name authorized_creator,
    name collection_name,
    name schema_name,
    bool transferable,
    bool burnable,
    uint32_t max_supply,
    ATTRIBUTE_MAP immutable_data,
    ATTRIBUTE_MAP mutable_data
) {  
    internal_create_template(authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data, mutable_data);
}

/**
* Deletes a template if the issued supply is zero
* @required_auth authorized_editor, who is within the authorized_accounts list of the collection
**/
ACTION atomicassets::deltemplate(
    name authorized_editor,
    name collection_name,
    int32_t template_id
) {
    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    templates_t collection_templates = get_templates(collection_name);
    auto template_itr = collection_templates.require_find(template_id,
        "No template with the specified id exists for the specified collection");

    check(template_itr->issued_supply == 0,
        "Can't delete a template that has any assets issued");

    template_mutables_t template_mutables = get_template_mutables(collection_name);
    auto template_mutables_itr = template_mutables.find(template_id);
    if (template_mutables_itr != template_mutables.end()){
        template_mutables.erase(template_mutables_itr);
    }

    collection_templates.erase(template_itr);
}

/**
* Sets the max supply of the template to the issued supply
* This means that afterwards no new assets of this template can be minted
* @required_auth authorized_editor, who is within the authorized_accounts list of the collection
**/
ACTION atomicassets::locktemplate(
    name authorized_editor,
    name collection_name,
    int32_t template_id
) {
    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    check(template_id >= 0, "The template id must be positive");

    templates_t collection_templates = get_templates(collection_name);
    auto template_itr = collection_templates.require_find(template_id,
        "No template with the specified id exists for the specified collection");

    check(template_itr->issued_supply != 0,
        "Can't lock a template that does not have at least one issued asset");

    collection_templates.modify(template_itr, same_payer, [&](auto &_template) {
        _template.max_supply = _template.issued_supply;
    });
}

/**
* Reduces the max supply of the template to the new max supply
* This means that afterwards, NFTs can only be minted up to the new max supply
* @required_auth authorized_editor, who is within the authorized_accounts list of the collection
**/

ACTION atomicassets::redtemplmax(
    name authorized_editor,
    name collection_name,
    int32_t template_id,
    uint32_t new_max_supply
) {
    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    templates_t collection_templates = get_templates(collection_name);
    auto template_itr = collection_templates.require_find(template_id,
        "No template with the specified id exists for the specified collection");

    check(new_max_supply > 0, 
        "The new max supply can't be set to zero (infinite)");

    check(template_itr->issued_supply <= new_max_supply, 
        "The new max supply can't be lower than the issued supply");

    check(template_itr->max_supply == 0 || template_itr->max_supply > new_max_supply, 
        "The new max supply must be lower than the existing max supply");

    collection_templates.modify(template_itr, same_payer, [&](auto &_template) {
        _template.max_supply = new_max_supply;
    });

}

/**
*  Creates a new asset
*  Doesn't work if the template has a specified max_supply that has already been reached
*  @required_auth authorized_minter, who is within the authorized_accounts list of the collection
                  specified in the related template
*/
ACTION atomicassets::mintasset(
    name authorized_minter,
    name collection_name,
    name schema_name,
    int32_t template_id,
    name new_asset_owner,
    ATTRIBUTE_MAP immutable_data,
    ATTRIBUTE_MAP mutable_data,
    vector <asset> tokens_to_back
) {
    check_has_collection_auth(
        authorized_minter,
        collection_name
    );

    schemas_t collection_schemas = get_schemas(collection_name);
    auto schema_itr = collection_schemas.require_find(schema_name.value,
        "No schema with this name exists");

    //Needed for the log action
    ATTRIBUTE_MAP deserialized_template_data;
    if (template_id >= 0) {
        templates_t collection_templates = get_templates(collection_name);

        auto template_itr = collection_templates.require_find(template_id,
            "No template with this id exists");

        check(template_itr->schema_name == schema_name,
            "The template belongs to another schema");

        if (template_itr->max_supply > 0) {
            check(template_itr->issued_supply < template_itr->max_supply,
                "The template's maxsupply has already been reached");
        }
        collection_templates.modify(template_itr, same_payer, [&](auto &_template) {
            _template.issued_supply += 1;
        });

        deserialized_template_data = deserialize(
            template_itr->immutable_serialized_data,
            schema_itr->format
        );
    } else {
        check(template_id == -1, "The template id must either be an existing template or -1");

        deserialized_template_data = {};
    }

    check(is_account(new_asset_owner), "The new_asset_owner account does not exist");

    check_name_length(immutable_data);
    check_name_length(mutable_data);

    auto config = get_config();
    config_s current_config = config.get();
    uint64_t asset_id = current_config.asset_counter++;
    config.set(current_config, get_self());

    assets_t new_owner_assets = get_assets(new_asset_owner);
    new_owner_assets.emplace(authorized_minter, [&](auto &_asset) {
        _asset.asset_id = asset_id;
        _asset.collection_name = collection_name;
        _asset.schema_name = schema_name;
        _asset.template_id = template_id;
        _asset.ram_payer = authorized_minter;
        _asset.backed_tokens = {};
        _asset.immutable_serialized_data = serialize(immutable_data, schema_itr->format);
        _asset.mutable_serialized_data = serialize(mutable_data, schema_itr->format);
    });


    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logmint"),
        make_tuple(
            asset_id,
            authorized_minter,
            collection_name,
            schema_name,
            template_id,
            new_asset_owner,
            immutable_data,
            mutable_data,
            tokens_to_back,
            deserialized_template_data
        )
    ).send();

    check(tokens_to_back.size() == 0, 
            "Native backing has been deprecated on the AtomicAssets Contract");
}


/**
*  Updates the mutable data of an asset
*  @required_auth authorized_editor, who is within the authorized_accounts list of the collection
                  specified in the related template
*/
ACTION atomicassets::setassetdata(
    name authorized_editor,
    name asset_owner,
    uint64_t asset_id,
    ATTRIBUTE_MAP new_mutable_data
) {
    assets_t owner_assets = get_assets(asset_owner);

    auto asset_itr = owner_assets.require_find(asset_id,
        "No asset with this id exists");

    name collection_name = asset_itr->collection_name;

    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    check_name_length(new_mutable_data);

    schemas_t collection_schemas = get_schemas(asset_itr->collection_name);
    auto schema_itr = collection_schemas.find(asset_itr->schema_name.value);

    ATTRIBUTE_MAP deserialized_old_data = deserialize(
        asset_itr->mutable_serialized_data,
        schema_itr->format
    );

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logsetdata"),
        make_tuple(asset_owner, asset_id, deserialized_old_data, new_mutable_data)
    ).send();


    owner_assets.modify(asset_itr, authorized_editor, [&](auto &_asset) {
        _asset.ram_payer = authorized_editor;
        _asset.mutable_serialized_data = serialize(new_mutable_data, schema_itr->format);
    });
}

/**
*  Updates the mutable data of a template within the templatedata table
*  If the row doesn't exist within the template, it emplaces a new row
*  If the new_mutable_data is empty & the row exists, it eraes the row
*  @required_auth authorized_editor, who is within the authorized_accounts list of the collection
                  specified in the related template
*/

ACTION atomicassets::settempldata(
    name authorized_editor,
    name collection_name,
    int32_t template_id,
    ATTRIBUTE_MAP new_mutable_data
) {
    check_has_collection_auth(
        authorized_editor,
        collection_name
    );

    templates_t collection_templates = get_templates(collection_name);
    auto template_itr = collection_templates.require_find(template_id,
        "No template with the specified id exists for the specified collection");

    schemas_t collection_schemas = get_schemas(collection_name);
    auto schema_itr = collection_schemas.require_find(template_itr->schema_name.value,
        "No schema with this name exists");

    check_name_length(new_mutable_data);

    template_mutables_t template_mutables = get_template_mutables(collection_name);
    auto template_mutables_itr = template_mutables.find(template_id);

    ATTRIBUTE_MAP deserialized_old_data;

    if (template_mutables_itr != template_mutables.end()){
        deserialized_old_data = deserialize(
            template_mutables_itr->mutable_serialized_data,
            schema_itr->format
        );
    }

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logsetdatatl"),
        make_tuple(collection_name, template_itr->schema_name, template_id, deserialized_old_data, new_mutable_data)
    ).send();

    // If entry doesn't exist && new_mutable_data is not empty, then emplace entry
    if (template_mutables_itr == template_mutables.end() && new_mutable_data.size() > 0){
        template_mutables.emplace(authorized_editor, [&](auto &_template_mutables) {
            _template_mutables.template_id = template_id;
            _template_mutables.schema_name = template_itr->schema_name;
            _template_mutables.mutable_serialized_data = serialize(new_mutable_data, schema_itr->format);
        });
    }

    // If entry exists && new_mutable_data is not empty, then modify entry
    if (template_mutables_itr != template_mutables.end() && new_mutable_data.size() > 0){
        template_mutables.modify(template_mutables_itr, authorized_editor, [&](auto &_template_mutables) {
            _template_mutables.mutable_serialized_data = serialize(new_mutable_data, schema_itr->format);
        });
    }

    // If entry exists && new_mutable_data is empty, then erase entry
    if (template_mutables_itr != template_mutables.end() && new_mutable_data.size() == 0){
        template_mutables.erase(template_mutables_itr);
    }

}

/**
*  Transfers responsibility for an asset's RAM cost to its current owner
*  The previous ram_payer is refunded the freed RAM
*  @required_auth new_payer, who must be the current owner of the asset
*/
ACTION atomicassets::setrampayer(
    name new_payer,
    uint64_t asset_id
) {
    require_auth(new_payer);

    assets_t owner_assets = get_assets(new_payer);

    auto asset_itr = owner_assets.require_find(asset_id,
        "No asset with this id exists in the new_payer's account");

    check(asset_itr->ram_payer != new_payer,
        "new_payer is already the ram_payer of this asset");

    name old_ram_payer = asset_itr->ram_payer;

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logrampayer"),
        make_tuple(new_payer, asset_id, old_ram_payer, new_payer)
    ).send();

    owner_assets.modify(asset_itr, new_payer, [&](auto &_asset) {
        _asset.ram_payer = new_payer;
    });
}


ACTION atomicassets::setlastpayer(
    name owner,
    name collection_name
) {
    require_auth(owner);

    assets_t owner_assets = get_assets(owner);

    check(owner_assets.begin() != owner_assets.end(), "owner holds no assets");

    // Decrement a named (lvalue) iterator rather than the end() temporary, which
    // is ill-formed for typical multi_index iterators.
    auto asset_itr = owner_assets.end();
    --asset_itr;

    check(asset_itr->collection_name == collection_name,
        "newest owned asset is not in the expected collection");

    check(asset_itr->ram_payer != owner,
        "owner is already the ram_payer of this asset");

    name old_ram_payer = asset_itr->ram_payer;

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logrampayer"),
        make_tuple(owner, asset_itr->asset_id, old_ram_payer, owner)
    ).send();

    owner_assets.modify(asset_itr, owner, [&](auto &_asset) {
        _asset.ram_payer = owner;
    });
}


/**
* This action is used to add a zero value asset to the quantities vector of owner in the balances table
* If no row exists for owner, a new one is created
* This action needs to be called before transferring (depositing) any tokens to the AtomicAssets smart contract,
* in order to pay for the RAM that otherwise would have to be paid by the AtomicAssets smart contract
*
* To pass a symbol to eosio as a string, use the following format: <precision>,<symbol_code>
* So for example: "8,WAX"
*
* @required_auth owner
*/
ACTION atomicassets::announcedepo(
    name owner,
    symbol symbol_to_announce
) {
    require_auth(owner);

    auto config = get_config();
    config_s current_config = config.get();

    bool is_supported = false;
    for (extended_symbol supported_token : current_config.supported_tokens) {
        if (supported_token.get_symbol() == symbol_to_announce) {
            is_supported = true;
            break;
        }
    }
    check(is_supported, "The specified symbol is not supported");

    auto balances = get_balances();
    auto balance_itr = balances.find(owner.value);

    if (balance_itr == balances.end()) {
        vector <asset> quantities = {asset(0, symbol_to_announce)};
        balances.emplace(owner, [&](auto &_balance) {
            _balance.owner = owner;
            _balance.quantities = quantities;
        });

    } else {
        vector <asset> quantities = balance_itr->quantities;
        for (asset &token : quantities) {
            if (token.symbol == symbol_to_announce) {
                //The symbol has already been announced
                return;
            }
        }
        quantities.push_back(asset(0, symbol_to_announce));

        balances.modify(balance_itr, owner, [&](auto &_balance) {
            _balance.quantities = quantities;
        });
    }
}


/**
* Withdraws fungible tokens that were previously deposited
*
* @required_auth owner
*/
ACTION atomicassets::withdraw(
    name owner,
    asset token_to_withdraw
) {
    require_auth(owner);

    check(token_to_withdraw.amount > 0, "token_to_withdraw must be positive");

    //The internal_decrease_balance function will throw if owner does not have a sufficient balance
    internal_decrease_balance(owner, token_to_withdraw);

    auto config = get_config();
    config_s current_config = config.get();

    for (extended_symbol supported_token : current_config.supported_tokens) {
        if (supported_token.get_symbol() == token_to_withdraw.symbol) {
            action(
                permission_level{get_self(), name("active")},
                supported_token.get_contract(),
                name("transfer"),
                make_tuple(
                    get_self(),
                    owner,
                    token_to_withdraw,
                    string("Withdrawal")
                )
            ).send();
            break;
        }
    }
}


/**
* Backs an asset with a fungible token that was previously deposited by payer
* payer also pays for the full RAM of the asset that is backed
* 
* @required_auth payer
*/
ACTION atomicassets::backasset(
    name payer,
    name asset_owner,
    uint64_t asset_id,
    asset token_to_back
) {
    check(false, 
        "Native backing has been deprecated on the AtomicAssets Contract");
}


/**
*  Burns (deletes) an asset
*  Only works if the "burnable" bool in the related template is true
*  If the asset has been backed with tokens previously, they are sent to the owner of the asset
*  @required_auth asset_owner
*/
ACTION atomicassets::burnasset(
    name asset_owner,
    uint64_t asset_id
) {
    require_auth(asset_owner);

    // A rental-locked asset cannot be burned (that would destroy the lister's
    // reclaim right).
    check_not_leased(asset_id);

    assets_t owner_assets = get_assets(asset_owner);
    auto asset_itr = owner_assets.require_find(asset_id,
        "No asset with this id exists for this owner");

    if (asset_itr->template_id >= 0) {
        templates_t collection_templates = get_templates(asset_itr->collection_name);

        auto template_itr = collection_templates.find(asset_itr->template_id);
        check(template_itr->burnable, "The asset is not burnable");
    };

    if (asset_itr->backed_tokens.size() != 0) {
        auto balances = get_balances();
        auto balance_itr = balances.find(asset_owner.value);
        if (balance_itr == balances.end()) {
            // If the asset_owner does not have a balance table entry yet, a new one is created
            balances.emplace(asset_owner, [&](auto &_balance) {
                _balance.owner = asset_owner,
                _balance.quantities = asset_itr->backed_tokens;
            });
        } else {
            // Any backed tokens are added to the asset_owners balance
            vector <asset> quantities = balance_itr->quantities;

            for (asset backed_quantity : asset_itr->backed_tokens) {
                bool found_token = false;
                for (asset &token : quantities) {
                    if (token.symbol == backed_quantity.symbol) {
                        found_token = true;
                        token.amount += backed_quantity.amount;
                        break;
                    }
                }
                if (!found_token) {
                    quantities.push_back(backed_quantity);
                }
            }

            balances.modify(balance_itr, asset_owner, [&](auto &_balance) {
                _balance.quantities = quantities;
            });
        }
    }


    schemas_t collection_schemas = get_schemas(asset_itr->collection_name);
    auto schema_itr = collection_schemas.find(asset_itr->schema_name.value);

    ATTRIBUTE_MAP deserialized_immutable_data = deserialize(
        asset_itr->immutable_serialized_data,
        schema_itr->format
    );
    ATTRIBUTE_MAP deserialized_mutable_data = deserialize(
        asset_itr->mutable_serialized_data,
        schema_itr->format
    );

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("logburnasset"),
        make_tuple(
            asset_owner,
            asset_id,
            asset_itr->collection_name,
            asset_itr->schema_name,
            asset_itr->template_id,
            asset_itr->backed_tokens,
            deserialized_immutable_data,
            deserialized_mutable_data,
            asset_itr->ram_payer
        )
    ).send();

    owner_assets.erase(asset_itr);
}


/**
*  Creates an offer
*  Offers are two sided, with the only requirement being that at least one asset is included in one of the sides
*  @required_auth sender
*/
ACTION atomicassets::createoffer(
    name sender,
    name recipient,
    vector <uint64_t> sender_asset_ids,
    vector <uint64_t> recipient_asset_ids,
    string memo
) {
    require_auth(sender);

    check(is_account(recipient), "The recipient account deos not exist");

    check(sender != recipient, "Can't send an offer to yourself");

    check(sender_asset_ids.size() != 0 || recipient_asset_ids.size() != 0,
        "Can't create an empty offer");

    check(memo.length() <= 256, "An offer memo can only be 256 characters max");

    vector <uint64_t> sender_ids_copy = sender_asset_ids;
    std::sort(sender_ids_copy.begin(), sender_ids_copy.end());
    check(std::adjacent_find(sender_ids_copy.begin(), sender_ids_copy.end()) == sender_ids_copy.end(),
        "The assets in sender_asset_ids must be unique");

    vector <uint64_t> recipient_ids_copy = recipient_asset_ids;
    std::sort(recipient_ids_copy.begin(), recipient_ids_copy.end());
    check(std::adjacent_find(recipient_ids_copy.begin(), recipient_ids_copy.end()) == recipient_ids_copy.end(),
        "The assets in recipient_asset_ids must be unique");

    assets_t sender_assets = get_assets(sender);
    assets_t recipient_assets = get_assets(recipient);

    for (uint64_t asset_id : sender_asset_ids) {
        auto asset_itr = sender_assets.find(asset_id);
        if (asset_itr == sender_assets.end()){
            check(false,
                ("Offer sender doesn't own at least one of the provided assets (ID: " + to_string(asset_id) + ")").c_str());
        }

        // A renter is the real owner of a leased asset, so get_assets(sender)
        // exposes it here. Block offering a rental-locked asset out.
        check_not_leased(asset_id);

        if (asset_itr->template_id >= 0) {
            templates_t collection_templates = get_templates(asset_itr->collection_name);

            auto template_itr = collection_templates.find(asset_itr->template_id);
            if (!template_itr->transferable){
                check(false,
                    ("At least one asset isn't transferable (ID: " + to_string(asset_id) + ")").c_str());
            }
        }
    }
    for (uint64_t asset_id : recipient_asset_ids) {
        auto asset_itr = recipient_assets.find(asset_id);
        if (asset_itr == recipient_assets.end()){
            check(false, 
                ("Offer recipient doesn't own at least one of the provided assets (ID: " + to_string(asset_id) + ")").c_str());
        }
        if (asset_itr->template_id >= 0) {
            templates_t collection_templates = get_templates(asset_itr->collection_name);

            auto template_itr = collection_templates.find(asset_itr->template_id);
            if (!template_itr->transferable){
                check(false,
                    ("At least one asset isn't transferable (ID: " + to_string(asset_id) + ")").c_str());
            }
        }
    }

    auto config = get_config();
    config_s current_config = config.get();
    uint64_t offer_id = current_config.offer_counter++;

    auto offers = get_offers();
    offers.emplace(sender, [&](auto &_offer) {
        _offer.offer_id = offer_id;
        _offer.sender = sender;
        _offer.recipient = recipient;
        _offer.sender_asset_ids = sender_asset_ids;
        _offer.recipient_asset_ids = recipient_asset_ids;
        _offer.memo = memo;
        _offer.ram_payer = sender;
    });

    config.set(current_config, get_self());

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("lognewoffer"),
        make_tuple(offer_id, sender, recipient, sender_asset_ids, recipient_asset_ids, memo)
    ).send();
}


/**
*  Cancels (deletes) an existing offer
*  @required_auth The offer's creator
*/
ACTION atomicassets::canceloffer(
    uint64_t offer_id
) {
    auto offers = get_offers();
    auto offer_itr = offers.require_find(offer_id,
        "No offer with this id exists");

    require_auth(offer_itr->sender);

    offers.erase(offer_itr);
}


/**
*  Accepts an offer
*  The items specified in the offer from either side are transferred to the corresponding other side
*  If a new scope needs to be created, each side of the offer will pay for their own scope
*  @require_auth The offer's recipient
*/
ACTION atomicassets::acceptoffer(
    uint64_t offer_id
) {
    auto offers = get_offers();
    auto offer_itr = offers.require_find(offer_id,
        "No offer with this id exists");

    require_auth(offer_itr->recipient);

    require_recipient(offer_itr->sender);
    require_recipient(offer_itr->recipient);

    assets_t sender_assets = get_assets(offer_itr->sender);
    assets_t recipient_assets = get_assets(offer_itr->recipient);
    for (uint64_t asset_id : offer_itr->sender_asset_ids) {
        auto asset_itr = sender_assets.find(asset_id);
        if (asset_itr == sender_assets.end()){
            check(false, 
                ("Offer sender doesn't own at least one of the provided assets (ID: " + to_string(asset_id) + ")").c_str());
        }
    }
    for (uint64_t asset_id : offer_itr->recipient_asset_ids) {
        auto asset_itr = recipient_assets.find(asset_id);
        if (asset_itr == recipient_assets.end()){
            check(false, 
                ("Offer recipient doesn't own at least one of the provided assets (ID: " + to_string(asset_id) + ")").c_str());
        }
    }

    if (offer_itr->recipient_asset_ids.size() != 0) {
        //Potential scope costs for offer sender are offset by removing the entry from the offer table
        internal_transfer(
            offer_itr->recipient,
            offer_itr->sender,
            offer_itr->recipient_asset_ids,
            string("Accepted Offer ID: " + to_string(offer_id)),
            offer_itr->ram_payer
        );
    }

    if (offer_itr->sender_asset_ids.size() != 0) {
        internal_transfer(
            offer_itr->sender,
            offer_itr->recipient,
            offer_itr->sender_asset_ids,
            string("Accepted Offer ID: " + to_string(offer_id)),
            offer_itr->recipient
        );
    }

    offers.erase(offer_itr);
}


/**
*  Declines an offer
*  The offer is then erased from the tables
*  @require_auth The offer's recipient
*/
ACTION atomicassets::declineoffer(
    uint64_t offer_id
) {
    auto offers = get_offers();
    auto offer_itr = offers.require_find(offer_id,
        "No offer with this id exists");

    require_auth(offer_itr->recipient);

    offers.erase(offer_itr);
}


/**
* Pays for the RAM of an existing offer (thus freeing the RAM of the previous payer)
* The main purpose for this is to allow dapps to pay for the RAM of offer that their users create
* in order to make sure that the users don't run out of RAM
* @require_auth payer
*/
ACTION atomicassets::payofferram(
    name payer,
    uint64_t offer_id
) {
    require_auth(payer);

    auto offers = get_offers();
    auto offer_itr = offers.require_find(offer_id,
        "No offer with this id exists");

    offers_s offer_copy = *offer_itr;

    offers.erase(offer_itr);

    offers.emplace(payer, [&](auto &_offer) {
        _offer = offer_copy;
        _offer.ram_payer = payer;
    });
}


/**
*  This function is called when a transfer receipt from any token contract is sent to the atomicassets contract
*  It handels deposits and adds the transferred tokens to the sender's balance table row
*/
void atomicassets::receive_token_transfer(name from, name to, asset quantity, string memo) {
    if (to != get_self()) {
        return;
    }

    auto config = get_config();
    config_s current_config = config.get();

    bool is_supported = false;
    for (extended_symbol token : current_config.supported_tokens) {
        if (token.get_contract() == get_first_receiver() && token.get_symbol() == quantity.symbol) {
            is_supported = true;
        }
    }
    check(is_supported, "The transferred token is not supported");

    if (memo == "deposit") {
        auto balances = get_balances();
        auto balance_itr = balances.require_find(from.value,
            "You need to first initialize the balance table row using the announcedepo action");

        //Quantities refers to the quantities value in the balances table row, quantity is the asset that was transferred
        vector <asset> quantities = balance_itr->quantities;
        bool found_token = false;
        for (asset &token : quantities) {
            if (token.symbol == quantity.symbol) {
                found_token = true;
                token.amount += quantity.amount;
                break;
            }
        }
        check(found_token, "You first need to announce the asset type you're backing using the announcedepo action");

        balances.modify(balance_itr, same_payer, [&](auto &_balance) {
            _balance.quantities = quantities;
        });

    } else {
        check(false, "invalid memo");
    }
}


ACTION atomicassets::logtransfer(
    name collection_name,
    name from,
    name to,
    vector <uint64_t> asset_ids,
    string memo
) {
    require_auth(get_self());

    notify_collection_accounts(collection_name);
}

ACTION atomicassets::loglock(
    name collection_name,
    uint64_t asset_id,
    name title_owner,
    name renter,
    uint32_t rental_end,
    name market
) {
    require_auth(get_self());

    require_recipient(title_owner);
    if (renter != name("")) {
        require_recipient(renter);
    }
    notify_collection_accounts(collection_name);
}

ACTION atomicassets::logreclaim(
    name collection_name,
    uint64_t asset_id,
    name title_owner,
    name renter
) {
    require_auth(get_self());

    require_recipient(title_owner);
    if (renter != name("")) {
        require_recipient(renter);
    }
    notify_collection_accounts(collection_name);
}


ACTION atomicassets::lognewoffer(
    uint64_t offer_id,
    name sender,
    name recipient,
    vector <uint64_t> sender_asset_ids,
    vector <uint64_t> recipient_asset_ids,
    string memo
) {
    require_auth(get_self());

    require_recipient(sender);
    require_recipient(recipient);
}


ACTION atomicassets::lognewtempl(
    int32_t template_id,
    name authorized_creator,
    name collection_name,
    name schema_name,
    bool transferable,
    bool burnable,
    uint32_t max_supply,
    ATTRIBUTE_MAP immutable_data
) {
    require_auth(get_self());

    notify_collection_accounts(collection_name);
}


ACTION atomicassets::logmint(
    uint64_t asset_id,
    name authorized_minter,
    name collection_name,
    name schema_name,
    int32_t template_id,
    name new_asset_owner,
    ATTRIBUTE_MAP immutable_data,
    ATTRIBUTE_MAP mutable_data,
    vector <asset> backed_tokens,
    ATTRIBUTE_MAP immutable_template_data
) {
    require_auth(get_self());

    require_recipient(new_asset_owner);

    notify_collection_accounts(collection_name);
}


ACTION atomicassets::logsetdata(
    name asset_owner,
    uint64_t asset_id,
    ATTRIBUTE_MAP old_data,
    ATTRIBUTE_MAP new_data
) {
    require_auth(get_self());

    assets_t owner_assets = get_assets(asset_owner);
    auto asset_itr = owner_assets.find(asset_id);

    notify_collection_accounts(asset_itr->collection_name);
}

ACTION atomicassets::logsetdatatl(
    name collection_name,
    name schema_name,
    int32_t template_id, 
    ATTRIBUTE_MAP old_data,
    ATTRIBUTE_MAP new_data
) {
    require_auth(get_self());

    notify_collection_accounts(collection_name);
}


ACTION atomicassets::logrampayer(
    name asset_owner,
    uint64_t asset_id,
    name old_ram_payer,
    name new_ram_payer
) {
    require_auth(get_self());

    assets_t owner_assets = get_assets(asset_owner);
    auto asset_itr = owner_assets.find(asset_id);

    notify_collection_accounts(asset_itr->collection_name);
}


ACTION atomicassets::logbackasset(
    name asset_owner,
    uint64_t asset_id,
    asset backed_token
) {
    require_auth(get_self());
}


ACTION atomicassets::logburnasset(
    name asset_owner,
    uint64_t asset_id,
    name collection_name,
    name schema_name,
    int32_t template_id,
    vector <asset> backed_tokens,
    ATTRIBUTE_MAP old_immutable_data,
    ATTRIBUTE_MAP old_mutable_data,
    name asset_ram_payer
) {
    require_auth(get_self());

    notify_collection_accounts(collection_name);
}

/**
* Function for creating a template, handling both the creation of normal templates & purely mutable templates
*/

void atomicassets::internal_create_template(
    name authorized_creator,
    name collection_name,
    name schema_name,
    bool transferable,
    bool burnable,
    uint32_t max_supply,
    ATTRIBUTE_MAP & immutable_data,
    ATTRIBUTE_MAP mutable_data
) { 
    check_has_collection_auth(
        authorized_creator,
        collection_name
    );

    schemas_t collection_schemas = get_schemas(collection_name);
    auto schema_itr = collection_schemas.require_find(schema_name.value,
        "No schema with this name exists");

    config_t config = get_config();
    config_s current_config = config.get();
    int32_t template_id = current_config.template_counter++;
    config.set(current_config, get_self());

    check(burnable || transferable, 
        "A template cannot be both non-transferable and non-burnable");

    templates_t collection_templates = get_templates(collection_name);

    check_name_length(immutable_data);
    collection_templates.emplace(authorized_creator, [&](auto &_template) {
        _template.template_id = template_id;
        _template.schema_name = schema_name;
        _template.transferable = transferable;
        _template.burnable = burnable;
        _template.max_supply = max_supply;
        _template.issued_supply = 0;
        if (immutable_data.size() > 0){
            _template.immutable_serialized_data = serialize(immutable_data, schema_itr->format);
        }
    });

    action(
        permission_level{get_self(), name("active")},
        get_self(),
        name("lognewtempl"),
        make_tuple(
            template_id,
            authorized_creator,
            collection_name,
            schema_name,
            transferable,
            burnable,
            max_supply,
            immutable_data
        )
    ).send();

    if (mutable_data.size() > 0){
        check_name_length(mutable_data);

        template_mutables_t template_mutables = get_template_mutables(collection_name);
        template_mutables.emplace(authorized_creator, [&](auto &_template_mutables) {
            _template_mutables.template_id = template_id;
            _template_mutables.schema_name = schema_name;
            _template_mutables.mutable_serialized_data = serialize(mutable_data, schema_itr->format);
        });

        action(
            permission_level{get_self(), name("active")},
            get_self(),
            name("logsetdatatl"),
            make_tuple(collection_name, schema_name, template_id, (ATTRIBUTE_MAP){}, mutable_data)
        ).send();
    }

}

/**
*  Transfers need to be handled like this (as a function instead of an action), because when accepting an offer,
*  we want each side of the offer to pay for their own scope. Because the recipient authorized the accept action,
*  he can be charged the RAM for his own scope, and because the offer is removed from the table, which was previously
*  paid by the offer sender, the action RAM delta for the sender account will still be positive even after paying
*  for the scope. This is allowed by the protocol feature RAM_RESTRICTIONS which needs to be enabled on the blockchain
*  that this contract is deployed on.
*/
void atomicassets::internal_transfer(
    name from,
    name to,
    vector <uint64_t> asset_ids,
    string memo,
    name scope_payer,
    bool enforce_lock
) {
    check(is_account(to), "to account does not exist");

    check(from != to, "Can't transfer assets to yourself");

    check(asset_ids.size() != 0, "asset_ids needs to contain at least one id");

    check(memo.length() <= 256, "A transfer memo can only be 256 characters max");

    vector <uint64_t> asset_ids_copy = asset_ids;
    std::sort(asset_ids_copy.begin(), asset_ids_copy.end());
    check(std::adjacent_find(asset_ids_copy.begin(), asset_ids_copy.end()) == asset_ids_copy.end(),
        "Can't transfer the same asset multiple times");

    assets_t from_assets = get_assets(from);
    assets_t to_assets = get_assets(to);

    map <name, vector <uint64_t>> collection_to_assets_transferred = {};

    for (uint64_t asset_id : asset_ids) {
        auto asset_itr = from_assets.find(asset_id);
        if (asset_itr == from_assets.end()){
            check(false,
                ("Sender doesn't own at least one of the provided assets (ID: " + to_string(asset_id) + ")").c_str());
        }

        // Rental lock: a leased asset can only be moved by the privileged
        // lease-start / reclaim paths (which pass enforce_lock = false).
        if (enforce_lock) check_not_leased(asset_id);

        //Existence doesn't have to be checked because this always has to exist
        if (asset_itr->template_id >= 0) {
            templates_t collection_templates = get_templates(asset_itr->collection_name);

            auto template_itr = collection_templates.find(asset_itr->template_id);
            if (!template_itr->transferable){
                check(false, 
                    ("At least one asset isn't transferable (ID: " + to_string(asset_id) + ")").c_str());
            }
        }

        //This is needed for sending notifications later
        if (collection_to_assets_transferred.find(asset_itr->collection_name) !=
            collection_to_assets_transferred.end()) {
            collection_to_assets_transferred[asset_itr->collection_name].push_back(asset_id);
        } else {
            collection_to_assets_transferred[asset_itr->collection_name] = {asset_id};
        }

        //to assets are empty => no scope has been created yet
        bool no_previous_scope = to_assets.begin() == to_assets.end();
        if (no_previous_scope) {
            //A dummy asset is emplaced, which makes the scope_payer pay for the ram of the scope
            //This asset is later deleted again.
            //This action will therefore fail is the scope_payer didn't authorize the action
            to_assets.emplace(scope_payer, [&](auto &_asset) {
                _asset.asset_id = ULLONG_MAX;
                _asset.collection_name = name("");
                _asset.schema_name = name("");
                _asset.template_id = -1;
                _asset.ram_payer = scope_payer;
                _asset.backed_tokens = {};
                _asset.immutable_serialized_data = {};
                _asset.mutable_serialized_data = {};
            });
        }

        to_assets.emplace(asset_itr->ram_payer, [&](auto &_asset) {
            _asset.asset_id = asset_itr->asset_id;
            _asset.collection_name = asset_itr->collection_name;
            _asset.schema_name = asset_itr->schema_name;
            _asset.template_id = asset_itr->template_id;
            _asset.ram_payer = asset_itr->ram_payer;
            _asset.backed_tokens = asset_itr->backed_tokens;
            _asset.immutable_serialized_data = asset_itr->immutable_serialized_data;
            _asset.mutable_serialized_data = asset_itr->mutable_serialized_data;
        });

        from_assets.erase(asset_itr);

        if (no_previous_scope) {
            to_assets.erase(to_assets.find(ULLONG_MAX));
        }
    }

    //Sending notifications
    for (const auto&[collection, assets_transferred] : collection_to_assets_transferred) {
        action(
            permission_level{get_self(), name("active")},
            get_self(),
            name("logtransfer"),
            make_tuple(collection, from, to, assets_transferred, memo)
        ).send();
    }
}


/**
*  Reverts if the asset has a live lease/title record (i.e. is rental-locked).
*  The lock is keyed purely on the existence of a leases row, so there is no
*  post-expiry abscondment window.
*/
void atomicassets::check_not_leased(uint64_t asset_id) {
    leases_t leases = get_leases();
    check(leases.find(asset_id) == leases.end(),
        ("Asset is leased and locked (ID: " + to_string(asset_id) + ")").c_str());
}


/**
*  Asserts that `market` is the configured rental market and is authorized. The
*  configured account is the single trusted opener/manager of leases.
*/
void atomicassets::check_rental_market(name market) {
    name configured = get_rentalcfg().get_or_default(rentalcfg_s{}).rental_market;
    check(configured != name("") && market == configured,
        "market is not the configured rental market");
    require_auth(market);
}


/**
*  Decreases the balance of a specified account by a specified quantity
*  If the specified account does not have at least as much tokens in the balance as should be removed
*  the transaction will fail
*/
void atomicassets::internal_decrease_balance(
    name owner,
    asset quantity
) {
    auto balances = get_balances();
    auto balance_itr = balances.require_find(owner.value,
        "The specified account does not have a balance table row");

    vector <asset> quantities = balance_itr->quantities;
    bool found_token = false;
    for (auto itr = quantities.begin(); itr != quantities.end(); itr++) {
        if (itr->symbol == quantity.symbol) {
            found_token = true;
            check(itr->amount >= quantity.amount,
                "The specified account's balance is lower than the specified quantity");
            itr->amount -= quantity.amount;
            if (itr->amount == 0) {
                quantities.erase(itr);
            }
            break;
        }
    }
    check(found_token,
        "The specified account does not have a balance for the symbol specified in the quantity");

    //Updating the balances table
    if (quantities.size() > 0) {
        balances.modify(balance_itr, same_payer, [&](auto &_balance) {
            _balance.quantities = quantities;
        });
    } else {
        balances.erase(balance_itr);
    }
}


/**
* check_has_collection_auth and notify_collection_accounts run constantly (incl. via inline
* actions) and each need only one vector<name> field, but a normal table read loads the whole
* row (including serialized_data, up to 3-4 KB) into cache. This reads just the needed prefix
* with db_get_i64 to save CPU.
*
* db_get_i64 returns only the row payload (no PK prefix). collections_s serializes as:
*   collection_name(8) author(8) allow_notify(1) authorized_accounts(1+8N) notify_accounts(1+8M)
*   market_fee(8) serialized_data(varint+blob)   // market_fee onward is truncated/unused here
*
* Each vector caps at 24, so the read budgets are:
*   auth   (type=false): through authorized_accounts, <=210 B  (buffer 330)
*   notify (type=true):  through notify_accounts,      <=403 B  (buffer 523)
*
* The auth path MUST early-return before `ds >> notify_accounts`: against the 330-byte buffer
* that read overflows on a large row and throws "datastream attempted to read past the end",
* bricking every check_has_collection_auth caller. See the early return below.
*/

vector<name> atomicassets::partial_read_collection(
    name & collection_name_,
    bool type
) {

    int collection_itr = eosio::internal_use_do_not_use::db_find_i64(get_self().value, get_self().value, name("collections").value, collection_name_.value);
    check(collection_itr >= 0, COLLECTION_NOT_FOUND);

    int data_size = eosio::internal_use_do_not_use::db_get_i64(collection_itr, nullptr, 0);
    check(data_size > 0, COLLECTION_NOT_FOUND);

    int read_size = min(data_size, !type ? 330 : 523); // Authorized Accounts vs Notify Accounts
    vector<char> buffer(read_size);
    eosio::internal_use_do_not_use::db_get_i64(collection_itr, buffer.data(), read_size);

    datastream<const char*> ds(buffer.data(), buffer.size());

    name collection_name, author;
    bool allow_notify;
    vector<name> authorized_accounts, notify_accounts;

    ds >> collection_name;
    ds >> author;
    ds >> allow_notify;
    ds >> authorized_accounts;

    // Auth path stops here; reading notify_accounts would overflow the 330-byte buffer (see above).
    if (!type) {
        return authorized_accounts;
    }

    ds >> notify_accounts;
    return notify_accounts;
}

/**
* Checks if the account_to_check is in the authorized_accounts vector of the specified collection
*/
void atomicassets::check_has_collection_auth(
    name & account_to_check,
    name & collection_name
) {
    require_auth(account_to_check);

    vector<name> authorized_accounts = partial_read_collection(collection_name, false);

    check(std::find(
        authorized_accounts.begin(),
        authorized_accounts.end(),
        account_to_check
        ) != authorized_accounts.end(),
        "Missing authorization for this collection");
}

/**
* Notifies all of a collection's notify accounts using require_recipient
*/
void atomicassets::notify_collection_accounts(
    name collection_name
) {
    vector<name> notify_accounts = partial_read_collection(collection_name, true);

    for (name & notify_account : notify_accounts) {
        require_recipient(notify_account);
    }
}

/**
* The "name" attribute is limited to 64 characters max for both assets and collections
* This function checks that, if there exists an ATTRIBUTE with name: "name", the value of it
* must be of length <= 64
*/
void atomicassets::check_name_length(
    ATTRIBUTE_MAP & data
) {
    auto data_itr = data.find("name");
    if (data_itr != data.end()) {
        if (std::holds_alternative <string>(data_itr->second)) {
            check(std::get <string>(data_itr->second).length() <= 64,
                "Names (attribute with name: \"name\") can only be 64 characters max");
        }
    }
}

