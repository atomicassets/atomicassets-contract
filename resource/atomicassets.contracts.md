<h1 class="contract">init</h1>

---
spec_version: "0.2.0"
title: Initialize config tables
summary: 'Initialize the tables "config" and "tokenconfig" if they have not been initialized before'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
Initialize the tables "config" and "tokenconfig" if they have not been initialized before. If they have been initialized before, nothing will happen.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{$action.account}}.
</div>




<h1 class="contract">admincoledit</h1>

---
spec_version: "0.2.0"
title: Extend collections schema
summary: 'Extends the schema to serialize collection data by one or more lines'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The following FORMAT lines are added to the schema that is used to serialize collections data:
{{#each collection_format_extension}}
    - name: {{this.name}} , type: {{this.type}}
{{/each}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{$action.account}}.
</div>




<h1 class="contract">setversion</h1>

---
spec_version: "0.2.0"
title: Set tokenconfig version
summary: 'Sets the version in the tokenconfigs table to {{nowrap new_version}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---
<b>Description:</b>
<div class="description">
The version in the tokenconfigs table is set to {{new_version}}.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{$action.account}}.
</div>




<h1 class="contract">addconftoken</h1>

---
spec_version: "0.2.0"
title: Add token to supported list
summary: 'Adds a token that can then be used to back assets'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---
<b>Description:</b>
<div class="description">
The token with the symbol {{token_symbol}} from the token contract {{token_contract}} is added to the supported_tokens list.

This means that assets can then be backed with that specific token.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{$action.account}}.
</div>




<h1 class="contract">transfer</h1>

---
spec_version: "0.2.0"
title: Transfer Assets
summary: 'Send one or more assets from {{nowrap from}} to {{nowrap to}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{from}} transfers one or more assets with the following ids to {{to}}:
{{#each asset_ids}}
    - {{this}}
{{/each}}

{{#if memo}}There is a memo attached to the transfer stating:
    {{memo}}
{{else}}No memo is attached to the transfer.
{{/if}}

If {{to}} does not own any assets, {{from}} pays the RAM for the scope of {{to}} in the assets table.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{from}}.

Transfers that do not serve any purpose other than spamming the recipient are not allowed.
</div>




<h1 class="contract">createschema</h1>

---
spec_version: "0.2.0"
title: Create a schema
summary: '{{nowrap authorized_creator}} creates a new schema with the name {{nowrap schema_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_creator}} creates a new schema with the name {{schema_name}}. This schema belongs to the collection {{collection_name}}

{{#if schema_format}}The schema will be initialized with the following FORMAT lines that can be used to serialize template and asset data:
    {{#each schema_format}}
        - name: {{this.name}} , type: {{this.type}}
    {{/each}}
{{else}}The schema will be initialized without any FORMAT lines.
{{/if}}

Only authorized accounts of the {{collection_name}} collection will be able to extend the schema by adding additional FORMAT lines in the future, but they will not be able to delete previously added FORMAT lines.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_creator}}.

{{authorized_creator}} has to be an authorized account in the collection {{collection_name}}.

Creating schemas with the purpose of confusing or taking advantage of others, especially by impersonating other well known brands, personalities or dapps is not allowed.
</div>




<h1 class="contract">extendschema</h1>

---
spec_version: "0.2.0"
title: Extend schema
summary: 'Extends the schema {{nowrap schema_name}} by adding one or more FORMAT lines'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The schema {{schema_name}} belonging to the collection {{collection_name}} is extended by adding the following FORMAT lines that can be used to serialize template and asset data:
{{#each schema_format_extension}}
    - name: {{this.name}} , type: {{this.type}}
{{/each}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_editor}}.

{{authorized_editor}} has to be an authorized account in the collection {{collection_name}}.
</div>




<h1 class="contract">createcol</h1>

---
spec_version: "0.2.0"
title: Create collection
summary: '{{nowrap author}} creates a new collection with the name {{collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{author}} creates a new collection with the name {{collection_name}}.

{{#if authorized_accounts}}The following accounts are added to the authorized_accounts list, allowing them create and edit templates and assets within this collection:
    {{#each authorized_accounts}}
        - {{this}}
    {{/each}}
{{else}}No accounts are added to the authorized_accounts list.
{{/if}}

{{#if notify_accounts}}The following accounts are added to the notify_accounts list, which means that they get notified on the blockchain of any actions related to assets and templates of this collection:
    {{#each notify_accounts}}
        - {{this}}
    {{/each}}
{{else}}No accounts are added to the notify_accounts list.
{{/if}}

{{#if allow_notify}}It will be possible to add more accounts to the notify_accounts list later.
{{else}}It will not be possible to add more accounts to the notify_accounts list later.
{{/if}}

The market_fee for this collection will be set to {{market_fee}}. 3rd party markets are encouraged to use this value to collect fees for the collection author, but are not required to do so.

{{#if data}}The collections will be initialized with the following data:
    {{#each data}}
        - name: {{this.key}} , value: {{this.value}}
    {{/each}}
{{else}}The collection will be initialized without any data.
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{author}}.

Creating collections with the purpose of confusing or taking advantage of others, especially by impersonating other well known brands, personalities or dapps is not allowed.

If the notify functionality is being used, the notify accounts may not make any transactions throw when receiving the notification. This includes, but is not limited to, purposely blocking certain transfers by making the transaction throw.

It is the collection author's responsibility to enforce that this does not happen.
</div>




<h1 class="contract">setcoldata</h1>

---
spec_version: "0.2.0"
title: Set collection data
summary: 'Sets the data of the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{#if data}}Sets the data of the collection {{collection_name}} to the following
    {{#each data}}
        - name: {{this.key}} , value: {{this.value}}
    {{/each}}
{{else}}Clears the data of the collection {{collection_name}}
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.
</div>




<h1 class="contract">addcolauth</h1>

---
spec_version: "0.2.0"
title: Make an account authorized in a collection
summary: 'Add the account {{nowrap account_to_add}} to the authorized_accounts list of the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
Adds the account {{account_to_add}} to the authorized_accounts list of the collection {{collection_name}}.

This allows {{account_to_add}} to both create and edit templates and assets of this collection.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.
</div>




<h1 class="contract">remcolauth</h1>

---
spec_version: "0.2.0"
title: Remove an account's authorization in a collection
summary: 'Remove the account {{nowrap account_to_remove}} from the authorized_accounts list of the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
Removes the account {{account_to_remove}} from the authorized_accounts list of the collection {{collection_name}}.

This removes {{account_to_remove}}'s permission to both create and edit templates and assets of this collection.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.
</div>




<h1 class="contract">addnotifyacc</h1>

---
spec_version: "0.2.0"
title: Add an account to a collection's notify list
summary: 'Add the account {{nowrap account_to_add}} to the notify_accounts list of the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
Adds the account {{account_to_add}} to the notify_accounts list of the collection {{collection_name}}.

This will make {{account_to_add}} get notifications directly on the blockchain when one of the following actions is performed:
- One or more assets of the collection {{collection_name}} is transferred
- An asset of the collection {{collection_name}} is minted
- An asset of the collection {{collection_name}} has its mutable data changed
- An asset of the collection {{collection_name}} is burned
- An asset of the collection {{collection_name}} gets backed with core tokens
- A template of the collection {{collection_name}} is created

{{account_to_add}} is able to add code to their own smart contract to handle these notifications. 
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.

{{account_to_add}} may not make any transactions throw when receiving a notification. This includes, but is not limited to, purposely blocking certain transfers by making the transaction throw.

It is the collection author's responsibility to enforce that this does not happen.
</div>




<h1 class="contract">remnotifyacc</h1>

---
spec_version: "0.2.0"
title: Remove an account from a collection's notfiy list
summary: 'Remove the account {{nowrap account_to_remove}} from the notify_accounts list of the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
Removes the account {{account_to_remove}} from the notify_accounts list of the collection {{collection_name}}.

{{account_to_remove}} will therefore no longer receive notifications for any of the actions related to the collection {{collection_name}}.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.
</div>




<h1 class="contract">setmarketfee</h1>

---
spec_version: "0.2.0"
title: Set collection market fee
summary: 'Sets the market fee of the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The market_fee for the collection {{collection_name}} will be set to {{market_fee}}. 3rd party markets are encouraged to use this value to collect fees for the collection author, but are not required to do so.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.
</div>




<h1 class="contract">forbidnotify</h1>

---
spec_version: "0.2.0"
title: Disallow collection notifications
summary: 'Sets the allow_notify value of the collection {{nowrap collection_name}} to false'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The allow_notify value of the collection {{collection_name}} is set to false.
This means that it will not be possible to add accounts to the notify_accounts list later.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the collection's author.
</div>




<h1 class="contract">createtempl</h1>

---
spec_version: "0.2.0"
title: Create a template
summary: '{{nowrap authorized_creator}} creates a new template which belongs to the {{nowrap collection_name}} collection and uses the {{nowrap schema_name}} schema'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_creator}} creates a new template which belongs to the {{collection_name}} collection.

The schema {{schema_name}} is used for the serialization of the template's data.

{{#if transferable}}The assets within this template will be transferable
{{else}}The assets within this template will not be transferable
{{/if}}

{{#if burnable}}The assets within this template will be burnable
{{else}}The assets within this template will not be burnable
{{/if}}

{{#if max_supply}}A maximum of {{max_supply}} assets can ever be created within this template.
{{else}}There is no maximum amount of assets that can be created within this template.
{{/if}}

{{#if immutable_data}}The immutable data of the template is set to:
    {{#each immutable_data}}
        - name: {{this.key}} , value: {{this.value}}
    {{/each}}
{{else}}No immutable data is set for the template.
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_creator}}.

{{authorized_creator}} has to be an authorized account in the collection {{collection_name}}.
</div>




<h1 class="contract">locktemplate</h1>

---
spec_version: "0.2.0"
title: Locks a template
summary: '{{nowrap authorized_editor}} locks the template with the id {{nowrap template_id}} belonging to the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_editor}} locks the template with the id {{template_id}} belonging to the collection {{collection_name}}.

This sets the template's maximum supply to the template's current supply, which means that no more assets referencing this template can be minted.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_creator}}.

{{authorized_creator}} has to be an authorized account in the collection {{collection_name}}.

The template's issued supply must be greater than 0.
</div>




<h1 class="contract">mintasset</h1>

---
spec_version: "0.2.0"
title: Mint an asset
summary: '{{nowrap authorized_minter}} mints an asset which will be owned by {{nowrap new_asset_owner}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_minter}} mints an asset of the template which belongs to the {{schema_name}} schema of the {{collection_name}} collection. The asset will be owned by {{new_asset_owner}}.

{{#if immutable_data}}The immutable data of the asset is set to:
    {{#each immutable_data}}
        - name: {{this.key}} , value: {{this.value}}
    {{/each}}
{{else}}No immutable data is set for the asset.
{{/if}}

{{#if mutable_data}}The mutable data of the asset is set to:
    {{#each mutable_data}}
        - name: {{this.key}} , value: {{this.value}}
    {{/each}}
{{else}}No mutable data is set for the asset.
{{/if}}

{{#if quantities_to_back}}The asset will be backed with the following tokens and {{authorized_minter}} needs to have at least that amount of tokens in their balance:
    {{#each quantities_to_back}}
        - {{quantities_to_back}}
    {{/each}}
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_minter}}.

{{authorized_minter}} has to be an authorized account in the collection that the template with the id {{template_id}} belongs to.

Minting assets that contain intellectual property requires the permission of the all rights holders of that intellectual property.

Minting assets with the purpose of confusing or taking advantage of others, especially by impersonating other well known brands, personalities or dapps is not allowed.

Minting assets with the purpose of spamming or otherwise negatively impacing {{new_owner}} is not allowed.
</div>




<h1 class="contract">setassetdata</h1>

---
spec_version: "0.2.0"
title: Set the mutable data of an asset
summary: '{{nowrap authorized_editor}} sets the mutable data of the asset with the id {{nowrap asset_id}} owned by {{nowrap asset_owner}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{#if new_mutable_data}}{{authorized_editor}} sets the mutable data of the asset with the id {{asset_id}} owned by {{nowrap asset_owner}} to the following:
    {{#each new_mutable_data}}
        - name: {{this.key}} , value: {{this.value}}
    {{/each}}
{{else}}{{authorized_editor}} clears the mutable data of the asset with the id {{asset_id}} owned by {{asset_owner}}.
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_editor}}.

{{authorized_editor}} has to be an authorized account in the collection that the asset with the id {{asset_id}} belongs to. (An asset belongs to the collection that the template it is within belongs to)
</div>




<h1 class="contract">setrampayer</h1>

---
spec_version: "0.2.0"
title: Set the RAM payer of an asset
summary: '{{nowrap new_payer}} takes over the RAM cost of the asset with the id {{nowrap asset_id}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{new_payer}} takes over responsibility for the RAM cost of the asset with the id {{asset_id}}. The previous RAM payer is refunded the freed RAM.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{new_payer}}.

{{new_payer}} has to be the current owner of the asset with the id {{asset_id}}.
</div>




<h1 class="contract">setlastpayer</h1>

---
spec_version: "0.2.0"
title: Set the RAM payer of the newest owned asset
summary: '{{nowrap owner}} takes over the RAM cost of the newest asset owned by {{nowrap owner}} in the collection {{nowrap collection_name}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{owner}} takes over responsibility for the RAM cost of the newest asset owned by {{owner}}. The previous RAM payer is refunded the freed RAM.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{owner}}.

The newest asset owned by {{owner}} has to be in the collection {{collection_name}}.
</div>




<h1 class="contract">announcedepo</h1>

---
spec_version: "0.2.0"
title: Announces a deposit
summary: '{{nowrap owner}} adds the symbol {{nowrap symbol_to_announce}} to his balance table row'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
This action is used to add a zero value asset to the quantities vector of the balance row with the owner {{owner}}.
If there is no balance row with the owner {{owner}}, a new one is created.
Adding something to a vector increases the RAM required, therefore this can't be done directly in the receipt of the transfer action, so using this action a zero value is added so that the RAM required doesn't change when adding the received quantity in the transfer action later.

By calling this action, {{payer}} pays for the RAM of the balance table row with the owner {{owner}}.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{payer}}.
</div>




<h1 class="contract">withdraw</h1>

---
spec_version: "0.2.0"
title: Withdraws fungible tokens
summary: '{{nowrap owner}} withdraws {{token_to_withdraw}} from his balance'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{owner}} withdraws {{token_to_withdraw}} that they previously deposited and have not yet spent otherwise.
The tokens will be transferred back to {{owner}} and will be deducted from {{owner}}'s balance.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{owner}}.
</div>




<h1 class="contract">backasset</h1>

---
spec_version: "0.2.0"
title: Deprecated, always fails (formerly: backs an asset with tokens)
summary: '{{nowrap payer}} attempts to back the asset with the ID {{nowrap asset_id}}; native backing is deprecated and this action fails'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
Native backing is deprecated on the AtomicAssets v2 contract. This action always fails and no tokens are moved.

Assets backed before v2 are unaffected. Burning such an asset credits its backed tokens to the burner's AtomicAssets token balance, which is then claimed with the withdraw action; the tokens are not transferred directly by the burn.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{payer}}.
</div>




<h1 class="contract">burnasset</h1>

---
spec_version: "0.2.0"
title: Burn an asset
summary: '{{nowrap asset_owner}} burns his asset with the id {{nowrap asset_id}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{asset_owner}} burns his asset with the id {{asset_id}}.

If there previously were tokens backed to this asset, these tokens are added to the balance table entry {{asset_owner}}.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{asset_owner}}.
</div>




<h1 class="contract">createoffer</h1>

---
spec_version: "0.2.0"
title: Create an offer
summary: '{{nowrap sender}} makes an offer to {{nowrap recipient}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{sender}} makes the following offer to {{recipient}}.

{{#if sender_asset_ids}}{{sender}} gives the assets with the following ids:
    {{#each sender_asset_ids}}
        - {{this}}
    {{/each}}
{{else}}{{sender}} does not give any assets.
{{/if}}

{{#if recipient_asset_ids}}{{recipient}} gives the assets with the following ids:
    {{#each recipient_asset_ids}}
        - {{this}}
    {{/each}}
{{else}}{{recipient}} does not give any assets.
{{/if}}

If {{recipient}} accepts the offer, the assets will automatically be transferred to the respective sides.

{{#if memo}}There is a memo attached to the offer stating:
    {{memo}}
{{else}}No memo is attached to the offer.
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{sender}}.

Creating offers that do not serve any purpose other than spamming the recipient is not allowed.

{{sender}} must not take advantage of the notification they receive when the offer is accepted or declined in a way that harms {{recipient}}.
</div>




<h1 class="contract">canceloffer</h1>

---
spec_version: "0.2.0"
title: Cancel an offer
summary: 'The offer with the id {{nowrap offer_id}} is cancelled'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The creator of the offer with the id {{offer_id}} cancels this offer. The offer is deleted from the offers table.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the creator of the offer.
</div>



<h1 class="contract">acceptoffer</h1>

---
spec_version: "0.2.0"
title: Accept an offer
summary: 'The offer with the id {{nowrap offer_id}} is accepted'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The recipient of the offer with the id {{offer_id}} accepts the offer.

The assets from either side specified in the offer are automatically transferred to the respective other side.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the recipient of the offer.
</div>



<h1 class="contract">declineoffer</h1>

---
spec_version: "0.2.0"
title: Decline an offer
summary: 'The offer with the id {{nowrap offer_id}} is declined'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The recipient of the offer with the id {{offer_id}} declines the offer. The offer is deleted from the offers table.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the recipient of the offer.
</div>



<h1 class="contract">payofferram</h1>

---
spec_version: "0.2.0"
title: Pays RAM for existing offer
summary: '{{nowrap payer}} will pay for the RAM cost of the offer {{nowrap offer_id}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{payer}} pays for the RAM cost of the offer {{offer_id}}. The offer itself is not modified
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{payer}}.
</div>

<h1 class="contract">createtempl2</h1>

---
spec_version: "0.2.0"
title: Create a template with mutable data
summary: '{{nowrap authorized_creator}} creates a new template which belongs to the {{nowrap collection_name}} collection and uses the {{nowrap schema_name}} schema'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_creator}} creates a new template which belongs to the {{collection_name}} collection.

The schema {{schema_name}} is used for the serialization of the template's data.

{{#if transferable}}The assets within this template will be transferable
{{else}}The assets within this template will not be transferable
{{/if}}

{{#if burnable}}The assets within this template will be burnable
{{else}}The assets within this template will not be burnable
{{/if}}

{{#if max_supply}}A maximum of {{max_supply}} assets can ever be created within this template.
{{else}}There is no maximum amount of assets that can be created within this template.
{{/if}}

Unlike createtempl, this action also sets mutable template data, which the collection's authorized accounts can change later with settempldata.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_creator}}, who must be an authorized account of the {{collection_name}} collection.
</div>

<h1 class="contract">settempldata</h1>

---
spec_version: "0.2.0"
title: Update a template's mutable data
summary: '{{nowrap authorized_editor}} updates the mutable data of template {{nowrap template_id}} in the {{nowrap collection_name}} collection'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_editor}} replaces the mutable data of the template {{template_id}} within the {{collection_name}} collection with {{new_mutable_data}}.

The template's immutable data, its transferability, its burnability and its maximum supply are not changed. Assets already minted from this template are affected, because mutable template data is read from the template rather than copied onto each asset.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_editor}}, who must be an authorized account of the {{collection_name}} collection.
</div>

<h1 class="contract">deltemplate</h1>

---
spec_version: "0.2.0"
title: Delete an unused template
summary: '{{nowrap authorized_editor}} deletes the template {{nowrap template_id}} from the {{nowrap collection_name}} collection'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_editor}} deletes the template {{template_id}} within the {{collection_name}} collection.

A template can only be deleted while no assets have been issued from it. The deletion is permanent and the template id is not reused.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_editor}}, who must be an authorized account of the {{collection_name}} collection.
</div>

<h1 class="contract">redtemplmax</h1>

---
spec_version: "0.2.0"
title: Reduce a template's maximum supply
summary: '{{nowrap authorized_editor}} reduces the maximum supply of template {{nowrap template_id}} to {{nowrap new_max_supply}}'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_editor}} lowers the maximum supply of the template {{template_id}} within the {{collection_name}} collection to {{new_max_supply}}.

The maximum supply can only be reduced, never raised, and never below the number of assets already issued from this template. The reduction is permanent.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_editor}}, who must be an authorized account of the {{collection_name}} collection.
</div>

<h1 class="contract">setschematyp</h1>

---
spec_version: "0.2.0"
title: Set media type descriptors for a schema
summary: '{{nowrap authorized_editor}} sets the media type descriptors of the {{nowrap schema_name}} schema in the {{nowrap collection_name}} collection'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
{{authorized_editor}} sets the media type descriptors of the schema {{schema_name}} within the {{collection_name}} collection to {{schema_format_type}}.

These descriptors record how each field of the schema should be interpreted, for example as an image or a video. They replace the schema's existing descriptors in full rather than merging with them, so any descriptor omitted here is removed.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of {{authorized_editor}}, who must be an authorized account of the {{collection_name}} collection.
</div>

<h1 class="contract">createauswap</h1>

---
spec_version: "0.2.0"
title: Propose a new collection author
summary: 'The author of {{nowrap collection_name}} proposes {{nowrap new_author}} as the collection's new author'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The current author of the {{collection_name}} collection proposes that {{new_author}} becomes its new author.

This action only records the proposal. The collection's author does not change until {{new_author}} calls acceptauswap. Until then the current author keeps full control and may withdraw the proposal.

{{#if owner}}The proposal also transfers the collection's owner permission.
{{else}}The proposal does not transfer the collection's owner permission.
{{/if}}
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the owner permission of the current author of the {{collection_name}} collection.
</div>

<h1 class="contract">acceptauswap</h1>

---
spec_version: "0.2.0"
title: Accept becoming a collection's author
summary: '{{nowrap collection_name}}'s proposed new author accepts the author change'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The account proposed as the new author of the {{collection_name}} collection accepts the change.

On acceptance the collection's author becomes the proposed account, and the pending proposal is removed. This transfers control of the collection, including the right to authorize accounts and to set the market fee.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of the account named as the new author in the pending proposal for {{collection_name}}.
</div>

<h1 class="contract">rejectauswap</h1>

---
spec_version: "0.2.0"
title: Reject or withdraw a proposed author change
summary: 'The pending author change for {{nowrap collection_name}} is rejected'
icon: https://atomicassets.io/image/logo256.png#108AEE3530F4EB368A4B0C28800894CFBABF46534F48345BF6453090554C52D5
---

<b>Description:</b>
<div class="description">
The pending author change for the {{collection_name}} collection is rejected and the proposal is removed.

The collection's author does not change. A new proposal can be created afterwards with createauswap.
</div>

<b>Clauses:</b>
<div class="clauses">
This action may only be called with the permission of either the current author of {{collection_name}} or the account named as the proposed new author.
</div>
