

## Plan: Add Plan % visual to the donut chart

Currently the donut chart shows only Actual % (blue arc) vs Remaining (dark). The Plan % is shown as text below. 

### Approach
Add a second `Pie` ring (smaller, outer or inner) to show Planned progress alongside Actual progress, creating a dual-ring donut chart.

- **Outer ring**: Plan % (e.g., amber/orange color) + remaining (dark)
- **Inner ring**: Actual % (blue) + remaining (dark)  
- Update the center label to show both values or keep Actual with Plan on the outer ring
- Add a small legend below showing color meanings

### Changes
**`src/components/dashboard/ProjectHUD.tsx`**:
1. Add `plannedDonutData` array: `[{ name: "Planned", value: avgPlanned }, { name: "Remaining", value: 100 - avgPlanned }]`
2. Add a second `<Pie>` element with a larger radius (outer ring) using an amber/orange fill for Plan %
3. Adjust radii: inner Pie (Actual) `innerRadius={28} outerRadius={40}`, outer Pie (Plan) `innerRadius={44} outerRadius={52}`
4. Replace the text below with a mini legend showing blue = Actual, amber = Plan

