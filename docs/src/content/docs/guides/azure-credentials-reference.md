---
title: "Azure credentials reference"
---

# Azure credentials reference

The Azure sync panel needs a **subscription id**, and it validates that the value is a GUID rather than a display name. This page shows how to read your own account details out of the Azure CLI.

This page previously contained a specific tenant's real subscription id, tenant id, tenant domain and account address. Those were removed when the repository became public — they are not access-granting secrets, but they are account identifiers and there is no reason to publish them. Read your own values with the commands below instead.

## Active account

```sh
az account show
```

Returns the fields the panel cares about:

| Field | Command |
| ----- | ------- |
| Subscription id | `az account show --query id -o tsv` |
| Subscription name | `az account show --query name -o tsv` |
| Tenant id | `az account show --query tenantId -o tsv` |
| Signed-in principal | `az account show --query user.name -o tsv` |

## Available subscriptions

```sh
az account list --query "[].{name:name, id:id, default:isDefault}" -o table
```

```
Name                    Id                                    Default
----------------------  ------------------------------------  ---------
<your-subscription>     <your-subscription-id>                 True
```

Switch the active subscription:

```sh
az account set --subscription <your-subscription-id>
```

## Note for maintainers

Do not paste real `az` output into this repository. If an example needs a value, use `<your-subscription-id>` style placeholders — a test under `test/docs/` fails the build if a GUID or an email address appears in any `azure*` guide.

## Related

- [Azure sync guide](azure-sync.md)
