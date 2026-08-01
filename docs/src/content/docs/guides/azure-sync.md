---
title: "Azure sync"
---

# Azure sync

Import live Azure resources onto the board as nodes and edges, so a C4 diagram can be reconciled against what is actually deployed.

The app does not talk to Azure directly. It shells out to the **Azure CLI** (`src-tauri/src/azure_sync.rs`) and runs `az graph query` against Azure Resource Graph. That means it inherits whatever account you are logged into with `az`, and it can only see what that account can see.

## Prerequisites

### 1. Install the Azure CLI

<https://learn.microsoft.com/cli/azure/install-azure-cli>

```sh
az version
```

### 2. Log in

```sh
az login
```

The panel reports authentication state by running `az account show`, so if that command works, the app is satisfied.

### 3. No extension required

Earlier versions ran `az graph query` as a subprocess, which needed the
`resource-graph` CLI extension and failed with `'graph' is misspelled` when it
was missing.

Queries now go straight to the Resource Graph REST API (ADR-018 Phase 1). The
CLI is still used, but only to obtain an access token, so nothing beyond
`az login` is needed. If you installed the extension previously you can leave
it; it is simply unused.

## Finding your subscription id

The sync panel is scoped to one or more subscriptions and validates that each one is a GUID, so you need the id rather than the display name.

```sh
az account show --query id -o tsv
```

If you have more than one:

```sh
az account list --query "[].{name:name, id:id, default:isDefault}" -o table
```

## Running a sync

1. Open the board.
2. Toggle the Azure panel from the sidebar brand action (**Show Azure sync panel**).
3. Enter the subscription id (or ids) to scope the query.
4. Run the query, review the returned resources, and apply the ones you want onto the board.

Applying is a board edit like any other — save the diagram to keep it.

## How resources become board nodes

Each Azure resource becomes one node, and each resource group becomes a container that owns the resources inside it.

The C4 type comes from a lookup table on the Azure resource type ([ADR-017](../architecture/adr/017-azure-resource-type-mapping.md)), following the shape of the judgement rather than the vendor's naming:

| Reads as | C4 type | Examples |
| -------- | ------- | -------- |
| A boundary other things run inside, or a store | `container` | managed environments, virtual networks, storage accounts, Log Analytics workspaces, container registries |
| Something that runs or acts | `component` | container apps, web sites, dashboards, managed identities |
| Reachable from outside the boundary | `externalSystem` | static web apps, Bing accounts |
| A top-level platform | `system` | Cognitive Services accounts, AKS clusters |

Azure has around 4,650 resource types, so the table is deliberately an override layer rather than the whole story. Classification runs in three tiers, most specific first:

1. **Exact type** — e.g. a static web app is an `externalSystem`.
2. **Provider namespace** — anything under `microsoft.keyvault`, `microsoft.sql`, `microsoft.storage` or `microsoft.cache` is a store; anything under `microsoft.network` or `microsoft.web` acts. This covers whole product families, child types included.
3. **Shape** — for providers with no rule: a nested type (`provider/type/child`) becomes a `component`, a top-level type becomes a `system`.

Nothing is ever dropped for being unrecognised, so a brand-new Azure service still imports and still lands somewhere sensible.

### Edges

Relationships are discovered three ways: ARM parent-child, an ARM `dependsOn`, and property references such as a web app's App Service Plan or a container app's managed environment. Resources with none of these import as unconnected nodes — that reflects the estate, not a failed sync.

## Tuning pagination

Resource Graph pages its results. Two optional variables control how the app walks those pages; both are declared in `.env.schema` and validated on load.

| Variable | Meaning | Bounds |
| -------- | ------- | ------ |
| `OPSYDYN_AZURE_GRAPH_PAGE_SIZE` | Rows requested per page | integer, 1–1000 |
| `OPSYDYN_AZURE_GRAPH_MAX_PAGES` | Maximum pages walked in one query | integer, 1–500 |

Leave them unset for the defaults. Raise `OPSYDYN_AZURE_GRAPH_MAX_PAGES` if a large subscription is being truncated; lower it to keep queries cheap while experimenting.

## Troubleshooting

| Symptom | Cause |
| ------- | ----- |
| `Azure CLI (az) was not found or failed to launch` | The CLI is not installed, or not on the `PATH` the desktop app inherits. A GUI app does not read your shell profile, so a CLI installed only for an interactive shell may be invisible to it. |
| Panel says not authenticated, `Run az login and retry` | No active `az` session. |
| `Azure denied this request (403)` | The signed-in principal lacks Reader on the requested scope. |
| `Azure rate limited this request (429)` | Azure throttled the query. Throttled and unavailable responses are retried automatically with backoff; this appears only when the retries are also refused. |
| `still failing after N attempts` | The transient failure did not clear. The underlying cause is quoted after the count. |
| `Azure Resource Graph rejected the query (400)` | The advanced KQL is invalid. The message carries Azure's own explanation. |
| `azure_graph_query requires at least one subscriptionId` | No subscription was set on the panel scope. |
| `received invalid subscription GUID(s)` | A subscription *name* was entered where the id is required. |
| Results look truncated | Raise `OPSYDYN_AZURE_GRAPH_MAX_PAGES`. |

## Related

- Design rationale: [ADR-007 Azure graph sync](../architecture/adr/007-azure-graph-sync.md)
- Shape of the returned data: [Azure Resource Graph sample data](azure-graph-sample-data.md)
- Finding account details: [Azure credentials reference](azure-credentials-reference.md)
- Roadmap: [Team topology and Azure sync](../overview/product-roadmap-team-topology-azure-sync.md)
