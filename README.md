## Straddle / Strangle Strategy

### Script to backtest & forward test the following strategy:


Non-Directional System

Strangle/Straddle without adjustments:

- Keep SL on both legs for safety in such a way that max loss will be 2% on capital if both SLs get triggered
- When 1 SL leg is hit, adjust and keep trailing SL on other leg
- Keep trailing the SLs (either at particular times OR every certain interval)

Straddle Adjustment Rules ->

- Sell CMP straddle at a particular time (Backtest to see favourable entry time)
- Check delta every 5 mins
- If the delta becomes greater than 0.2, then ->
	- If VIX keeps on rising, add more CE/PE legs (depending on market direction) (max 3) - When volatility crashes, position will benefit hugely
	- If VIX keeps falling, then sq off the higher delta leg, and sell a new leg matching existing delta
- If at any point, delta of any one leg reaches 0.9 then sq off the entire position. Can create a new straddle at CMP depending on time.
- Look to book profits / exit position around 2:45 - 3:00
- Max loss -> 2% of capital. Don't try to fight the market after this.

Strangle Adjustment Rules ->

- Sell strikes based on historical day range data (1STDEV for Nifty, 2STDEV for BNF) (check delta, pick strikes of around 20 delta)
- Check delta every 5 mins
- If the delta becomes greater than 0.3, then book the profitable leg and roll it up/down till a straddle is created. Then apply straddle management rules.
- Try to match delta while rolling, but don't match exact premium. Keep some room for premium reversal.
- If at any point, delta of any one leg reaches 0.9 then sq off the entire position.
- Book profits at 3:15
- Max loss -> 2% of capital. Don't try to fight the market after this.
