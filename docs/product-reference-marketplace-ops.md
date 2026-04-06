# Product Reference: Marketplace Ops Structure

## Purpose

This note captures the useful structural ideas observed in Sirena-like marketplace products.

It is **not** a copy spec.
It is a reference for shaping MarginPoint into a sharper operating tool.

Current priority:

1. ABC analysis for SKU portfolio control
2. effective supply planning

---

## What to keep from the reference

Useful structural patterns:

- one operational workspace for one seller account
- SKU as the main working entity
- dashboard as a control tower, not just a chart wall
- separate product/SKU workspace instead of mixing everything into one screen
- explicit filters by problem reason
- fast transition from overview to one SKU
- practical planning modules, not just reporting modules

---

## What not to copy

We do **not** need to reproduce:

- their full metric surface
- their entire AI audit workflow
- pricing-first product packaging
- every category of marketing analytics
- every screen under the same IA

MarginPoint should stay narrower and more operational.

---

## MarginPoint target shape

Core product logic:

- profit visibility
- weak and loss-making SKU detection
- ABC segmentation
- supply planning from stock + sales speed + horizon
- decision support instead of passive BI

Working product spine:

1. dashboard
2. SKU / products workspace
3. ABC analysis
4. supply planning
5. cash / unit economics / brief as supporting tools

---

## Recommended information architecture

Main sections:

- `Dashboard`
- `Products`
- `ABC Analysis`
- `Supply Planning`
- `Unit Economics`
- `Cash Gap`
- `Brief`
- `Settings`

This is the important part to remember:

- `Dashboard` answers: what is happening now
- `Products` answers: which SKU need attention
- `ABC Analysis` answers: where the portfolio concentration is
- `Supply Planning` answers: what and when to replenish

---

## Module 1: ABC Analysis

### Goal

Show which SKU create the core business result and which ones consume attention with weak contribution.

### Minimum outputs

- segmentation by `A / B / C`
- share of revenue by class
- share of contribution profit by class
- count of SKU by class
- top A items
- weak B items
- low-value C items

### Useful filters

- by period
- by category / subject
- by brand
- by tracked SKU only

### Recommended table fields

- SKU
- title
- revenue
- contribution profit
- margin
- units sold
- cumulative revenue share
- ABC class

### Recommended decisions from this screen

- protect A items
- inspect weak-margin A items
- review B items for growth potential
- simplify or deprioritize weak C items

### Important note

ABC analysis should be tied to **profit contribution**, not only revenue.
If needed, support two modes:

- `ABC by revenue`
- `ABC by contribution profit`

---

## Module 2: Supply Planning

### Goal

Help the seller avoid stockout and overstock using a simple operational planning workflow.

### Minimum inputs

- current stock
- average sales velocity
- forecast horizon in days
- safety buffer
- optional in-transit stock

### Minimum outputs

- days to zero
- recommended replenishment quantity
- urgency level
- stockout risk window

### Recommended table fields

- SKU
- current stock
- in transit
- daily sales speed
- days to zero
- target coverage days
- recommended replenishment
- urgency

### Priority logic

- `critical`: stockout expected very soon
- `watch`: low coverage, replenishment should be planned now
- `ok`: stock is sufficient
- `overstock`: coverage materially above target

### Decisions this module should support

- what to replenish first
- how much to send
- which SKU are safe to delay
- where cash should not be frozen in excess stock

---

## Domain entities to support these two modules

- `SKU`
- `DailySkuMetric`
- `TrackedSkuSelection`
- `WarehouseSnapshot`
- `SupplyForecast`
- `CostProfile`

Additional useful computed concepts:

- `abcClass`
- `dailySalesVelocity`
- `daysToZero`
- `recommendedReplenishmentUnits`
- `supplyPriority`

---

## Product positioning implication

MarginPoint should not become a generic analytics suite.

The better framing is:

- profit operating system for marketplace sellers
- with portfolio prioritization through ABC
- and supply decisions through stock coverage planning

---

## Practical implementation order

1. add ABC metrics and classification to SKU aggregates
2. add warehouse / stock snapshots
3. build `ABC Analysis` screen
4. build `Supply Planning` screen
5. connect both back to `Dashboard`

---

## Decision rule

When choosing what to build next, prefer features that answer one of these questions:

- where is profit concentrated?
- which SKU matter most?
- which SKU are about to run out?
- how much should be replenished?
- what deserves action today?

If a feature does not help answer those questions, it is probably secondary.
