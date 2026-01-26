# 📊 Financial Projection Lab

> A powerful, interactive financial planning tool for modeling your path to financial independence. Run sophisticated projections, compare scenarios, and visualize your financial future with Monte Carlo simulations.

**🎯 Built for people who understand financial planning but need a powerful tool to model their future.**

---

## 🚀 Quick Start

1. **Open the app**: Simply open `index.html` in your web browser (no installation required!)
2. **Start planning**: Begin with the Settings tab to define your household
3. **Add accounts**: Set up your investment accounts, income, and expenses
4. **View projections**: Switch to Dashboard to see your financial trajectory

💡 **Zero cost. Zero tracking. Zero data collection. Your financial data stays on YOUR computer.**

---

## 📚 Table of Contents

- [✨ Core Features](#-core-features)
- [🏁 Getting Started Guide](#-getting-started-guide)
- [🗂️ Tab-by-Tab Guide](#️-tab-by-tab-guide)
- [🔥 Advanced Features](#-advanced-features)
- [💡 Tips & Best Practices](#-tips--best-practices)
- [📖 Understanding the Output](#-understanding-the-output)
- [🎓 Example Scenarios](#-example-scenarios)
- [💾 Data Management](#-data-management)

---

## ✨ Core Features

### 🎯 **Comprehensive Financial Modeling**
- ✅ Model investment accounts (taxable, traditional IRA/401k, Roth, HSA, cash)
- ✅ Track income streams (salary, pensions, Social Security)
- ✅ Plan expenses with inflation adjustment
- ✅ Model home ownership with mortgages and equity growth
- ✅ Track debts (student loans, credit cards, auto loans)
- ✅ Plan major life milestones (home purchases, college, weddings)

### 📈 **Tax-Optimized Withdrawal Engine**
- 🎯 Intelligent withdrawal sequencing (taxable → traditional → Roth → HSA)
- 🎯 Tax gross-up calculations (withdraws enough to cover both expenses AND taxes)
- 🎯 RMD (Required Minimum Distribution) enforcement at age 73
- 🎯 Handles tax bombs (student loan forgiveness, debt cancellation)
- 🎯 Supports both single and married filing statuses

### 🎲 **Monte Carlo Simulation**
- 📊 Run 1,000+ simulations with market volatility
- 📊 See 10th, 50th (median), and 75th percentile outcomes
- 📊 Focus on liquid net worth (excluding home equity)
- 📊 Visualize probability of success

### 📊 **Scenario Comparison**
- 🔄 Create multiple "what-if" scenarios
- 🔄 Compare side-by-side with interactive charts
- 🔄 Model decisions like buy vs. rent, early retirement, career changes
- 🔄 See both total and liquid net worth projections

### 🔄 **Dynamic Investment Strategy**
- 📈 Glide path support (adjust stock/bond allocation over time)
- 📈 Multiple withdrawal strategies (4% rule, fixed amount, dynamic, RMD-based)
- 📈 Inflation adjustment with configurable rates

---

## 🏁 Getting Started Guide

### Step 1: Settings ⚙️

**Start here** to establish the foundation of your plan.

#### 👥 Household Information
- **Birth year**: Used for RMD calculations (age 73+)
- **Filing status**: Single or Married Filing Jointly
- **Plan timeline**: Start year and projection length (up to 40 years)

#### 📈 Investment Glide Path
Define your asset allocation over time:

```
Example:
Age 30-50: 90% stocks → 7% return, 18% volatility
Age 50-65: 80% stocks → 6.5% return, 15% volatility
Age 65+:   60% stocks → 5% return, 10% volatility
```

This models shifting from aggressive growth to capital preservation.

#### 💰 Withdrawal Strategy

**When withdrawals start:** Typically your retirement year

**Strategy types:**
- **4% Rule** 📊: Classic inflation-adjusted withdrawal (safe but rigid)
- **Fixed Amount** 💵: Specific dollar amount each year
- **Dynamic (Guyton-Klinger)** 🎯: Adjusts based on portfolio performance (recommended!)
- **RMD** 📋: Based on IRS Required Minimum Distributions

**Withdrawal mode:**
- **As Needed** ✅: Only withdraw when expenses exceed income *(recommended)*
- **Always**: Take strategic withdrawals even with surplus income

---

### Step 2: Accounts 💰

Add all your investment accounts to get accurate projections.

#### Why this matters
The app needs to know where your money is to:
- Calculate tax-optimized withdrawals
- Apply correct tax treatment to gains
- Track account growth over time
- Enforce RMD rules on traditional accounts

#### Account Types

| Type | Examples | Tax Treatment | RMDs? |
|------|----------|---------------|-------|
| **Taxable** | Brokerage accounts | Capital gains on withdrawal | No |
| **Traditional** | IRA, 401k, 403b | Ordinary income on withdrawal | Yes (age 73+) |
| **Roth** | Roth IRA, Roth 401k | Tax-free withdrawals | No |
| **HSA** | Health Savings Account | Tax-free for medical | Sort of (age 65+) |
| **Cash** | Checking, savings | No investment returns | No |

💡 **Pro tip**: Be thorough! Include ALL accounts, even small ones. Over 30+ years, they matter.

---

### Step 3: Income 💵

Add your income streams with growth rates and time bounds.

#### Income Types
- 💼 **Salary**: W-2 employment income
- 🎓 **Retirement**: Pensions, Social Security
- 🏠 **Other**: Rental income, side hustles, royalties, etc.

#### Key Settings
- **Amount**: Annual or monthly (will be converted to annual)
- **Growth rate**: Model raises (3%), COLA adjustments (2%), or career progression
- **Start/End year**: When does this income begin and stop?

#### Example Setup
```
Salary:           $120,000/yr, 3% growth, ends 2045 (retirement)
401k Match:       $12,000/yr, 3% growth, ends 2045 (tied to salary)
Social Security:  $35,000/yr, 0% growth, starts 2050 (age 67)
Pension:          $20,000/yr, 0% growth, starts 2045 (retirement)
```

💡 **Pro tip**: Use separate income entries for different growth patterns (base salary vs. bonus vs. pension).

---

### Step 4: Expenses 💳

Model your annual living costs accurately.

#### Why Annual, Not Monthly?
Monthly feels natural, but annual captures irregular expenses:
- Property tax (annual)
- Insurance premiums (quarterly/annual)
- Vacations (once or twice per year)
- Holiday spending (December spike)

Enter monthly expenses × 12 or just enter the annual total.

#### Categories to Include
- 🏠 Housing (rent/mortgage, utilities, maintenance, HOA)
- 🚗 Transportation (car payment, insurance, gas, maintenance)
- 🍔 Food (groceries, dining out)
- 🏥 Healthcare (insurance premiums, out-of-pocket)
- 🎭 Entertainment (subscriptions, hobbies, travel)
- 👔 Personal (clothing, grooming, gifts)
- 💼 Professional (career expenses, education)

#### Inflation Rates by Category
```
Most expenses:     2-3% (general inflation)
Healthcare:        3-5% (grows faster than inflation)
Housing (rent):    3-4% (varies by market)
Education:         5-6% (if planning for college)
```

💡 **Pro tip**: Start conservative! Better to overestimate expenses and have surplus than vice versa.

---

### Step 5: Planning 📋

Add the optional complexity of real life.

#### 🏠 Housing

**Option 1: Renting**
- Monthly rent amount
- Inflation rate (typically 3-4%)
- Start/end years
- Simple and straightforward

**Option 2: Buying**
- **Purchase price**: Total home price
- **Down payment**: Typically 10-20%
- **Closing costs** 🆕: Typically 2-5% of purchase price
  - Loan origination fees
  - Appraisal, inspection
  - Title insurance
  - Escrow fees
- **Mortgage details**: Rate, term (15/30 years)
- **Extra payments**: Accelerate payoff
- **Home appreciation**: Typically 3% long-term average
- **Selling costs** 🆕: Typically 8-10% of sale price
  - Realtor commission (6%)
  - Closing costs (2-4%)
- **Sell year** (optional): When you plan to sell

#### 💡 Buy vs. Rent Comparison

To compare buying vs. renting:

1. **Create Scenario 1 - Renting**
   - Add rent as expense ($2,500/mo = $30k/yr)
   - Set 3.5% rent inflation

2. **Create Scenario 2 - Buying**
   - Purchase: $500k home
   - Down payment: $100k (20%)
   - Closing costs: $15k (3%)
   - Mortgage: $400k at 6.5%, 30 years
   - Selling costs: 8%
   - Appreciation: 3%
   - Sell year: 2054 (30 years later)

3. **Compare in Scenarios Tab**
   - Look at liquid net worth (dotted lines)
   - Renting = higher liquid assets early on
   - Buying = builds home equity over time
   - Crossover point typically 7-12 years

**What to look for:**
- Liquid net worth at retirement (what you can actually spend)
- Total net worth at end of timeline
- Flexibility needs (renting is more flexible)
- Market assumptions (home appreciation can vary wildly)

---

#### 💳 Debts

Track and model payoff strategies.

**Student Loans**
- Federal or private
- Standard, extended, or Income-Driven Repayment (IDR)
- 🚨 **IDR Forgiveness = Tax Bomb!**
  - After 20-25 years, remaining balance forgiven
  - Forgiven amount is taxable as ordinary income
  - $100k forgiven = ~$22k tax bill in forgiveness year
  - **Must plan for this!**

**Credit Cards**
- Balance, APR, minimum payment %
- Extra payment amount (accelerates payoff dramatically)
- Watch interest charges compound

**Auto Loans**
- Simple amortization
- See payoff timeline
- Model trade-in cycles

💡 **Pro tip**: Model aggressive debt payoff vs. investing. Sometimes paying off 6% debt is better than hoping for 7% returns.

---

#### 🎓 Milestones

Major life events with financial impact.

**Examples:**

| Milestone | Type | Amount | Tax Impact |
|-----------|------|--------|------------|
| College tuition | Recurring (4 years) | $40k/year | Not taxable |
| Wedding | One-time | $30k | Not taxable |
| Home down payment | One-time | $100k | Handled by housing module |
| Large vacation | One-time or recurring | $10k | Not taxable |
| Inheritance | Windfall | $200k | May be taxable (consult CPA) |
| Student loan forgiveness | Taxable event | $100k | TAXABLE! Big tax bill |
| Vehicle purchase | One-time | $35k | Not taxable |

#### Milestone Settings
- **Amount**: Cost or windfall amount
- **Frequency**: One-time or recurring
- **Duration**: If recurring, how many years?
- **Taxable?** Check if it creates taxable income (debt forgiveness, inheritance)
- **Windfall?** Check if it adds money to portfolio (inheritance, bonus)

💡 **Critical**: Student loan forgiveness via IDR is TAXABLE but NOT a windfall. It's a tax bomb!

---

## 🗂️ Tab-by-Tab Guide

### 📊 Dashboard

Your main projection view showing year-by-year financial trajectory.

#### What You See

**Projection Table:**
- Year-by-year breakdown (start year → end year)
- All inflows and outflows
- Running portfolio balance
- Tax calculations
- Net worth including home equity

#### Key Metrics Explained

| Metric | Meaning | What to Look For |
|--------|---------|------------------|
| **Start Balance** | Portfolio value at beginning of year | Steady growth over time |
| **Income** | Gross income before taxes | Drops at retirement |
| **Taxes** | Federal income tax (2024 brackets) | Should be lower in retirement |
| **Expenses** | Annual living costs | Increases with inflation |
| **Contributions** | After-tax savings (income - taxes - expenses) | 15-20% during working years |
| **Windfall Contributions** | One-time windfalls (inheritance, bonuses) | Separated so savings rate stays meaningful |
| **Withdrawals** | Money taken from portfolio | Only in retirement or deficits |
| **Investment Returns** | Growth from market | Varies by glide path |
| **End Balance** | Portfolio value at end of year | Should never hit zero! |
| **Net Worth** | Total assets minus debts | Includes home equity |

#### 🚨 Critical Warnings

**Withdrawal Shortfall > 0**: You ran out of money! This is BAD.
- Reduce expenses
- Delay retirement
- Increase savings rate
- Adjust withdrawal strategy

**Effective Tax Rate Spikes**: Usually caused by:
- RMDs starting at age 73
- Tax bombs (student loan forgiveness)
- Large traditional IRA withdrawals
- Can optimize with Roth conversions (not yet in this tool)

#### Export Options
- **Download as CSV**: Opens in Excel for deep-dive analysis
- **Save Configuration**: Backup your complete plan

---

### 📈 Scenarios

Compare different life paths side-by-side.

#### How to Use Scenarios

**Step 1: Create Base Scenario**
- Model your current plan
- Include all accounts, income, expenses as they exist today

**Step 2: Add Alternative Scenarios**
- Click "Add Scenario"
- Give it a descriptive name
- Modify the assumptions
- Click "Save Scenario"

**Step 3: Compare**
- View all scenarios on one chart
- Solid lines = Total net worth (includes home equity)
- Dotted lines = Liquid net worth (spendable assets only)
- Same color = same scenario

#### Scenario Ideas

| Scenario Name | What to Change |
|---------------|----------------|
| **Retire at 55 vs. 60 vs. 65** | Withdrawal start year, income end year |
| **Buy Home vs. Rent** | Housing module settings |
| **High Savings vs. Low Savings** | Expense levels |
| **Career Change** | Income reduction, expense changes |
| **Geographic Arbitrage** | Lower expenses, same assets |
| **Aggressive Debt Payoff** | Extra debt payments vs. investing |
| **Part-Time Retirement** | Reduced income + expenses for 5 years |

#### Reading the Comparison Chart

- 📊 **Y-axis**: Net worth in dollars
- 📅 **X-axis**: Years
- 🟢 **Solid lines**: Total net worth (includes home)
- ⚪ **Dotted lines**: Liquid net worth (excludes home)

**What matters most?**
Focus on the **dotted lines** (liquid net worth). Home equity isn't spendable in retirement!

💡 **Pro tip**: Create a "worst case" scenario with conservative assumptions (low returns, high expenses) to stress-test your plan.

---

### 🎲 Monte Carlo Simulation

Stress-test your plan against market volatility.

#### What It Does
Runs 1,000+ simulations with randomized returns based on your expected return ± volatility.

Real markets don't return exactly 7% every year. They swing wildly:
- 2008: -37%
- 2013: +32%
- 2018: -4%
- 2019: +31%
- 2020: +18%
- 2022: -18%

Monte Carlo shows how your plan holds up across thousands of random market sequences.

#### What You See

**Three Percentile Lines:**
- 🟢 **75th Percentile**: Optimistic outcome (market performs well)
- 🔵 **50th Percentile (Median)**: Average outcome
- 🔴 **10th Percentile**: Pessimistic outcome (market performs poorly)

#### How to Interpret Results

| Result | Interpretation | Action |
|--------|----------------|--------|
| ✅ All lines stay positive | Plan is robust | You're good! |
| ⚠️ 10th percentile dips negative | 10% chance of running out | Add safety margin |
| 🔴 Median goes negative | Plan needs major adjustment | Serious changes needed |
| 🟢 75th goes way up | If lucky, you'll die rich | Consider more spending/giving |

#### Y-Axis Scaling

The chart focuses on **liquid net worth** (excluding home equity) so you can see what's happening to your spendable money.

- Solid lines: Liquid net worth
- Faint dashed line: Total net worth (may go off-chart as home appreciates)

#### Configuring the Simulation

**Number of Simulations:**
- 100: Quick preview (rough estimate)
- 1,000: Standard (good balance of speed and accuracy)
- 10,000: High precision (slower but more accurate percentiles)

**Volatility Settings:**
Should match your asset allocation:
- 90%+ stocks: 18-20% volatility
- 60-80% stocks: 12-15% volatility
- 40-50% stocks: 8-10% volatility
- Conservative: 5-7% volatility

💡 **Pro tip**: If your 10th percentile comes close to zero at any point, consider adjusting:
- Reduce expenses 10%
- Delay retirement 2-3 years
- Increase savings rate 5%
- Choose more conservative withdrawal strategy

---

### 🌡️ Stress Test

See how your plan handles specific economic scenarios.

#### Available Scenarios

**Historical Crashes:**
- 📉 2008 Financial Crisis (-37%, -8%, +26%, +15%)
- 📉 Dot-Com Bubble Burst (2000-2002)
- 📉 1970s Stagflation (high inflation, low returns)
- 📉 2020 COVID Crash & Recovery (-34%, +18%, +27%)

**Why This Matters:**
Monte Carlo assumes normal distribution (bell curve). Real crashes are clustered and correlated. Stress testing shows if you'd survive actual historical sequences.

**Sequence of Returns Risk:**
Having poor returns EARLY in retirement is devastating. Stress testing reveals this.

Example:
- Retire in 2007 → 2008 crash → may never recover
- Retire in 2010 → catch the recovery → portfolio thrives

Same average returns, wildly different outcomes based on sequence.

#### Focus on Liquid Net Worth

Like Monte Carlo, stress test emphasizes spendable assets (excluding home).

💡 **Pro tip**: If you fail stress tests but pass Monte Carlo, your plan is fragile. Add buffer!

---

### 📋 Taxes

Understand your tax situation year-by-year.

#### Tax Table Shows

- 💰 **Income by source**: Salary, pensions, Social Security
- 🏦 **Traditional withdrawals**: Taxed as ordinary income
- 💣 **Tax bombs**: Student loan forgiveness, debt cancellation
- 📝 **Standard deduction**: $14,600 (single) or $29,200 (married)
- 🧮 **Federal taxes**: Based on 2024 tax brackets
- 📊 **Effective tax rate**: Actual % of income paid in taxes
- 🎯 **Marginal bracket**: Highest bracket you're in

#### Key Insights

**What to Look For:**

✅ **Effective rate drops in retirement**
- Working years: 15-25%
- Retirement: 5-15%
- If not, you may be withdrawing too much from traditional accounts

⚠️ **RMD Tax Spike at Age 73**
- Required Minimum Distributions force withdrawals
- Can push you into higher brackets
- Strategy: Spend down traditional accounts before RMDs start

🚨 **Tax Bomb Years**
- Student loan forgiveness: +$100k taxable income
- Debt cancellation: Also taxable
- Plan to have cash/Roth to pay the tax bill

#### Understanding Effective vs. Marginal Rate

**Marginal Rate**: The tax rate on your NEXT dollar
- Example: 24% bracket means next $1,000 earned is taxed at $240

**Effective Rate**: Average rate on ALL income
- Example: $100k income, $15k taxes = 15% effective rate

Your effective rate is always lower than marginal because of standard deduction and progressive brackets.

#### Tax Calculation Details

**Formula:**
```
Gross Income
+ Traditional IRA/401k Withdrawals  (taxed as ordinary income)
+ Tax Bombs                         (debt forgiveness, etc.)
= Total Taxable Income

Total Taxable Income
- Standard Deduction                ($14,600 single / $29,200 married)
= Taxable Income After Deduction

Apply Progressive Tax Brackets
= Federal Taxes Owed
```

**2024 Tax Brackets Used:**
- 10%: $0 - $11,600
- 12%: $11,600 - $47,150
- 22%: $47,150 - $100,525
- 24%: $100,525 - $191,950
- 32%: $191,950 - $243,725
- 35%: $243,725 - $609,350
- 37%: $609,350+

*(These are for single filers; married brackets are roughly double)*

**Not Included:**
- State and local taxes
- Capital gains (simplified model)
- Itemized deductions
- Tax credits

💡 **Pro tip**: Most people pay lower taxes in retirement. If you're not, consider Roth conversions during low-income years.

---

## 🔥 Advanced Features

### 💼 Tax-Optimized Withdrawals

The engine automatically withdraws in the most tax-efficient order.

#### Standard Sequence

1. **Taxable accounts first** (brokerage accounts)
   - Only capital gains taxed
   - Lower rates (0%, 15%, or 20% depending on income)
   - Most efficient to drain first

2. **Traditional accounts second** (IRA, 401k)
   - Ordinary income tax
   - Higher rates (10-37%)
   - But must take RMDs at age 73 anyway

3. **Roth accounts third** (Roth IRA, Roth 401k)
   - Tax-free withdrawals
   - Preserve as long as possible
   - Best for legacy/long life

4. **HSA last** (Health Savings Account)
   - Tax-free for medical expenses
   - After 65, penalty-free for non-medical (but still taxed)
   - Absolute best to preserve

#### Exception: Tax Bomb Years

If you have a milestone that creates taxable income (student loan forgiveness), the engine **skips traditional accounts** that year.

Why? To avoid stacking taxable income.

Example:
- Student loan forgiveness: +$100k taxable income
- Need $50k withdrawal
- Normal sequence: Take from traditional → adds $50k more taxable income → $150k total → massive tax bill
- Tax bomb sequence: Take from taxable/Roth instead → only $100k taxable income → saves thousands in taxes

The engine detects this automatically and adjusts.

---

### 🔄 Tax Gross-Up Loop

When you need to withdraw from portfolio to cover expenses, there's a chicken-and-egg problem:

1. You need money to pay expenses + taxes
2. But withdrawals from traditional accounts create more taxes
3. Which means you need to withdraw more
4. Which creates even more taxes
5. ...

The **tax gross-up loop** solves this iteratively:

```
Iteration 1:
- Expenses: $60k
- Estimated taxes: $8k (based on income alone)
- Withdrawal needed: $68k

Iteration 2:
- Withdrawal: $68k (est. $20k from traditional based on portfolio mix)
- Recalculated taxes: $12k (income + $20k traditional withdrawal)
- Withdrawal needed: $72k

Iteration 3:
- Withdrawal: $72k (est. $21.6k from traditional)
- Recalculated taxes: $12.5k
- Withdrawal needed: $72.5k

Iteration 4:
- Converged! ✅ (within $1)
```

This ensures you withdraw enough to cover BOTH expenses AND the taxes created by the withdrawal itself.

**Typically converges in 2-4 iterations.**

---

### 📉 RMD Enforcement

The IRS requires minimum distributions from traditional accounts starting at age 73.

#### How It Works

**RMD Calculation:**
```
RMD = Traditional Account Balance / Divisor

Divisors (IRS Uniform Lifetime Table):
Age 73: 26.5
Age 75: 24.6
Age 80: 20.2
Age 85: 16.0
Age 90: 12.2
Age 95: 8.9
Age 100: 6.4
```

**Example:**
- Age 75
- Traditional IRA balance: $500,000
- Divisor: 24.6
- RMD: $500,000 / 24.6 = $20,325

**You must withdraw at least $20,325** (can withdraw more).

#### Enforcement Logic

The engine checks:
1. Are you age 73 or older?
2. Do you have traditional account balances?
3. Have you withdrawn enough from traditional accounts this year?

If strategic withdrawal < RMD, it forces additional withdrawal to meet the minimum.

**RMD Penalties:**
Miss your RMD → 25% penalty on the amount not withdrawn! (Used to be 50%)

#### Planning Implications

**Strategy 1: Spend Down Traditional Early**
- Before age 73, aggressively withdraw from traditional accounts
- Fill up lower tax brackets (12%, 22%)
- Reduces future RMDs
- Gives you tax control

**Strategy 2: Roth Conversions**
- Convert traditional → Roth before age 73
- Pay taxes now at controlled rate
- No RMDs on Roth accounts
- *(Not yet modeled in this tool)*

💡 **Pro tip**: Model your traditional balance at age 73. If it's huge, you'll be forced to take large RMDs and may get pushed into higher brackets.

---

### 🏡 Home Equity Modeling

Complete integration of home purchase, ownership, and sale.

#### Purchase Year Cash Flow

**What happens:**
1. **Down payment** deducted from cash accounts
2. **Closing costs** deducted from cash accounts (2-5% typical)
3. Mortgage established
4. Home value tracked separately
5. Mortgage payment begins (included in expenses automatically)

**Example:**
- Purchase price: $500,000
- Down payment: $100,000 (20%)
- Closing costs: $15,000 (3%)
- **Total cash needed: $115,000**
- Mortgage: $400,000 at 6.5%, 30 years

#### During Ownership

**Each year:**
- Mortgage balance decreases (principal paydown)
- Home value appreciates (typically 3%)
- Home equity = Home value - Mortgage balance
- Equity grows from both appreciation and principal paydown

**Extra payments:**
- Accelerate principal paydown
- Reduce total interest paid
- Build equity faster
- Reach debt-free homeownership sooner

#### Sale Year Cash Flow

**What happens:**
1. Home value calculated (purchase price × (1 + appreciation rate)^years)
2. Mortgage balance calculated (amortization schedule)
3. **Selling costs** calculated (8-10% typical):
   - Realtor commission: ~6%
   - Title insurance: ~1%
   - Closing costs: ~1-3%
4. **Net proceeds** = Home value - Mortgage balance - Selling costs
5. Net proceeds added to cash accounts

**Example:**
- Purchase: $500k (2025)
- Sale: $900k (2055, 30 years later at 3% appreciation)
- Mortgage balance: $0 (paid off)
- Selling costs: $72k (8%)
- **Net proceeds: $828k**

#### Liquid vs. Total Net Worth

**Why this distinction matters:**

**Total Net Worth** = All assets - All debts (including home)
- Useful for "scorecard" purposes
- Feels good to see growth
- But misleading for retirement planning

**Liquid Net Worth** = Investment accounts only (excludes home)
- This is what you can actually spend
- Home equity is illiquid
- Can't sell your house to buy groceries
- **This is what matters for financial independence**

The app emphasizes liquid net worth in charts because that's your real financial flexibility.

**Exception:** Downsizing strategy
- Sell $900k home, buy $400k condo
- Frees up $428k in cash (after costs)
- This is modeled if you set a sell year

---

## 💡 Tips & Best Practices

### ✅ Do's

1. **✅ Be Conservative**
   - Overestimate expenses (add 10% buffer)
   - Underestimate investment returns (use 6-7%, not 10%)
   - Assume higher inflation (3% vs. 2%)
   - Plan for longevity (age 95+)

2. **✅ Include Everything**
   - Small accounts compound over decades
   - One-time windfalls and expenses
   - Tax bombs (student loan forgiveness)
   - Healthcare costs (often forgotten)

3. **✅ Model Inflation Accurately**
   - General expenses: 2-3%
   - Healthcare: 3-5%
   - Housing (rent): 3-4%
   - Education: 5-6%

4. **✅ Separate Scenarios**
   - Don't try to model everything in one plan
   - Create discrete scenarios for major decisions
   - Compare side-by-side

5. **✅ Focus on Liquid Net Worth**
   - Home equity isn't spendable
   - Watch the dotted lines in charts
   - This is your real financial independence number

6. **✅ Regular Updates**
   - Revisit plan annually
   - Update after major life changes
   - Track actual vs. projected
   - Adjust assumptions based on reality

7. **✅ Stress Test**
   - Run Monte Carlo simulations
   - Test against historical crashes
   - Add safety margins if marginal

8. **✅ Track Actual Performance**
   - Export CSV annually
   - Compare to actual account balances
   - Identify where projections diverged
   - Refine assumptions

---

### ❌ Don'ts

1. **❌ Don't Ignore Taxes**
   - Biggest expense in retirement for many people
   - Traditional IRA withdrawals are taxed as ordinary income
   - RMDs force withdrawals whether you need money or not
   - Tax bombs can spike your rate unexpectedly

2. **❌ Don't Forget RMDs**
   - Start at age 73 (2024 rules)
   - Mandatory, not optional
   - 25% penalty if missed
   - Can push you into higher brackets

3. **❌ Don't Overweight Home Value**
   - It's illiquid
   - Selling costs 8-10%
   - You need somewhere to live
   - Can't access equity easily
   - **Focus on liquid assets**

4. **❌ Don't Assume Perfect Returns**
   - Markets are volatile (15-20% standard deviation)
   - Sequence of returns matters hugely
   - A crash in year 1 of retirement can be devastating
   - Run Monte Carlo, not just straight-line projections

5. **❌ Don't Plan to Zero**
   - Leave safety margin
   - Unexpected expenses WILL happen
   - Healthcare costs spike with age
   - Better to die with money than run out at 85

6. **❌ Don't Forget Selling Costs**
   - Selling a home costs 8-10% of value
   - $500k home → $40-50k in costs
   - Eats into your equity significantly
   - Factor this into buy vs. rent analysis

7. **❌ Don't Ignore Tax Bombs**
   - Student loan forgiveness (IDR plans)
   - Debt cancellation (credit cards, etc.)
   - These create massive taxable income
   - Need cash/Roth to pay the tax bill
   - Can't use traditional IRAs (stacks more taxable income)

8. **❌ Don't Use Unrealistic Returns**
   - 10-12% returns are marketing fantasy
   - Realistic: 6-8% for stock-heavy portfolios
   - Closer to retirement: 4-6%
   - Remember: Inflation erodes returns
   - Real returns = Nominal - Inflation

---

## 📖 Understanding the Output

### 🎯 Key Metrics Explained

#### Savings Rate
```
Savings Rate = Contributions / Income
```

**Targets:**
- 15%: Traditional retirement (age 65)
- 25%: Comfortable retirement (age 60)
- 40-50%: Early retirement / FIRE (age 45-50)
- 70%+: Ultra-lean FIRE (age 30s)

**What's included:**
- Contributions = Income - Taxes - Expenses
- Does NOT include windfalls (keeps metric meaningful)

---

#### Effective Tax Rate
```
Effective Rate = Taxes / Total Taxable Income × 100

Total Taxable Income = Income + Traditional Withdrawals + Tax Bombs
```

**Typical ranges:**
- Working years (with salary): 15-25%
- Early retirement (before Social Security): 5-10%
- Later retirement (with Social Security + RMDs): 10-20%

**Why it changes:**
- Income drops in retirement → rate drops
- Traditional withdrawals add taxable income → rate increases
- RMDs force distributions → rate increases
- Tax bombs spike it temporarily

---

#### Withdrawal Shortfall
```
Shortfall = Desired Withdrawal - Portfolio Balance
```

**What it means:**
- **0**: You withdrew everything you needed ✅
- **>0**: You ran out of money! 🚨

**If shortfall occurs:**
1. Reduce expenses 10-20%
2. Delay retirement 2-3 years
3. Increase savings rate now
4. Adjust withdrawal strategy (more conservative)
5. Consider part-time work in retirement

---

#### Net Cash Flow
```
Net Cash Flow = Income - Taxes - Expenses + Windfalls - Milestone Costs
```

**Interpretation:**
- **Positive**: You're saving money ✅
- **Negative**: You're withdrawing from portfolio ⚠️

**Working years**: Should be consistently positive
**Retirement**: Will be negative (that's the point!)

---

### 📊 Reading the Charts

#### Dashboard Timeline
**What to look for:**
- ✅ Smooth growth during working years
- ✅ Gradual decline during retirement (sustainable)
- ⚠️ Spikes or dips (investigate causes)
- 🚨 Balance hits zero (ran out of money!)

**Typical shape:**
```
$$$
 $$  ← Accumulation phase (working)
  $$ ← Plateau (early retirement)
   $$ ← Gradual drawdown (later retirement)
    $$ ← Still have money at age 95 ✅
```

---

#### Scenario Comparison
**Understanding the lines:**
- 🟢 **Solid lines**: Total net worth (includes home equity)
- ⚪ **Dotted lines**: Liquid net worth (spendable assets)
- **Gap between solid and dotted**: Home equity (illiquid)

**Example interpretation:**
- Scenario A (Buy home): Solid line higher, dotted line lower
  - More total wealth (home equity)
  - Less liquid assets (tied up in house)

- Scenario B (Rent): Solid line lower, dotted line higher
  - Less total wealth (no home)
  - More liquid assets (more flexible)

**Which is better?** Depends on your priorities:
- Flexibility, travel, optionality → Rent (higher liquid net worth)
- Stability, legacy, forced savings → Buy (higher total net worth)

---

#### Monte Carlo Charts
**Understanding the bands:**
- 🟢 **75th percentile (top line)**: Optimistic outcome
  - Market performs well
  - 25% chance of doing even better

- 🔵 **50th percentile (middle line)**: Median outcome
  - Average market performance
  - 50/50 chance of doing better or worse

- 🔴 **10th percentile (bottom line)**: Pessimistic outcome
  - Market performs poorly
  - Only 10% chance of doing worse
  - This is your "plan for worst case"

**Width of band = Uncertainty**
- Narrow band: Low uncertainty, predictable outcome
- Wide band: High uncertainty, volatile outcome

**What success looks like:**
- ✅ All three lines stay above zero
- ✅ Even 10th percentile positive at end of timeline
- ✅ Median line shows comfortable surplus

**Red flags:**
- 🚨 10th percentile goes negative (10% failure rate)
- 🚨 Median goes negative (50% failure rate)
- ⚠️ 10th percentile comes close to zero (risky!)

---

### 🔍 Debugging Tax Calculations

For years 2033-2035 (configurable), detailed debugging output is logged.

#### How to View

1. Open browser Developer Tools
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12`
   - Safari: Enable Developer menu, then press `Cmd+Option+C`

2. Go to **Console** tab

3. Run your projection

4. Look for blocks like this:

```
========== TAX CALCULATION DEBUG: YEAR 2033 ==========

[1] NON-PORTFOLIO INCOME:
  Base Income (salary/pension): $35,000
  Milestone Taxable Income: $0
  Debt Taxable Income (forgiveness): $100,000  ← Tax bomb!

[2] EXPENSES & CASH NEEDS:
  Annual Expenses: $60,000
  Milestone Costs: $0
  Initial Tax Estimate (before withdrawals): $8,250
  Cash Needed Before Tax Gross-Up: $33,250

[3] TAX GROSS-UP LOOP:
  Portfolio: $850,000 (35% traditional)
  Converged after 3 iterations

[4] WITHDRAWALS BY ACCOUNT TYPE:
  Total Withdrawn: $35,200
    taxable: $22,880  ← From brokerage (tax-efficient)
    traditional: $0   ← Skipped due to tax bomb!
    roth: $12,320     ← Used Roth to avoid stacking taxable income
  Traditional Withdrawals (taxable): $0

[5] STANDARD DEDUCTION:
  Filing Status: married
  Standard Deduction: $29,200

[6] TAXABLE INCOME CALCULATION:
  Gross Income: $35,000
  + Traditional Withdrawals: $0
  + Milestone Tax Bombs: $0
  + Debt Tax Bombs: $100,000
  = Total Taxable Income: $135,000
  - Standard Deduction: $29,200
  = Taxable After Deduction: $105,800

[7] FINAL TAX CALCULATION:
  Federal Taxes: $16,956
  Effective Rate: 12.56%  ← Lower because smart withdrawal sequencing!
  Marginal Bracket: 22%

========== END TAX DEBUG ==========
```

#### What to Look For

✅ **Tax gross-up loop converged**: Should take 2-4 iterations
✅ **Withdrawal sequencing makes sense**: Taxable first, traditional second, etc.
✅ **Tax bomb years use Roth**: Avoids stacking taxable income
✅ **Effective rate reasonable**: Not paying more taxes than necessary

🚨 **Red flags:**
- Loop doesn't converge (oscillates)
- Withdrawing from traditional during tax bomb years
- Effective rate super high (>30%)
- Traditional withdrawals when Roth/taxable available

---

## 🎓 Example Scenarios

### 🏖️ Early Retirement (FIRE)

**Goal**: Retire at 45 with $1.5M portfolio

**Current situation:**
- Age: 30
- Income: $150k
- Expenses: $60k
- Savings rate: 60% ($90k/year)
- Current portfolio: $200k

**Setup:**

**Accounts:**
- Taxable brokerage: $100k
- 401k: $80k
- Roth IRA: $20k

**Income:**
- Salary: $150k, 3% growth, ends 2040 (age 45)
- (No Social Security until age 67)

**Expenses:**
- Living costs: $60k/year, 2.5% inflation
- Healthcare: $12k/year (until Medicare at 65), 4% inflation

**Withdrawal Strategy:**
- Start year: 2040 (age 45)
- Strategy: 4% rule
- Mode: As needed

**Investment Glide Path:**
- 2025-2040: 7% return, 18% volatility (aggressive)
- 2040-2055: 6% return, 12% volatility (moderate)
- 2055+: 5% return, 8% volatility (conservative)

**Milestones:**
- None major (simple lifestyle)

**Expected outcome:**
- Age 45: $1.5M portfolio
- Withdraw ~$60k/year (4% of $1.5M)
- Covers expenses + taxes
- Should sustain to age 95+

**Run Monte Carlo:**
- 10th percentile should stay positive
- If not: Save more, delay 1-2 years, or reduce expenses

---

### 🏡 Buy vs. Rent Analysis

**Goal**: Decide whether to buy $500k home or keep renting

**Current situation:**
- Age: 32
- Rent: $2,500/month ($30k/year)
- Savings: $120k (enough for down payment + closing)
- Income: $180k combined
- Current portfolio: $250k

---

**Scenario 1: Keep Renting**

**Housing:**
- Monthly rent: $2,500 → $30k/year
- Rent inflation: 3.5% (above general inflation)
- Duration: Next 30 years (2025-2055)

**Expenses:**
- Rent: $30k (grows 3.5%)
- Other: $50k (grows 2.5%)
- Total year 1: $80k

**Accounts:**
- Keep $120k invested in taxable account
- Continue maxing 401k ($23k/person)

---

**Scenario 2: Buy Home**

**Housing - Buying:**
- Purchase price: $500k (2025)
- Down payment: $100k (20%)
- Closing costs: $15k (3%)
- **Total upfront: $115k**
- Mortgage: $400k at 6.5%, 30-year
- Monthly payment: $2,528 (P&I only)
- Property tax: $6k/year
- Insurance: $2k/year
- Maintenance: $5k/year (1% of home value)
- **Total year 1 housing: $45k**
- Home appreciation: 3%
- Sell year: 2055 (30 years later)
- Selling costs: 8%

**Expenses:**
- Housing: $45k (mortgage + prop tax + insurance + maintenance)
- Other: $50k (grows 2.5%)
- Total year 1: $95k

**Accounts:**
- Only $5k left in taxable after down payment + closing
- Continue maxing 401k

---

**Compare Results:**

**Year 2055 (30 years later):**

| Metric | Rent | Buy |
|--------|------|-----|
| **Total Net Worth** | $3.2M | $3.8M |
| **Liquid Net Worth** | $3.2M | $2.9M |
| **Home Equity** | $0 | $900k |

**Interpretation:**
- **Buying**: Higher total net worth (+$600k)
  - But $900k is home equity (illiquid)
  - Only $2.9M spendable

- **Renting**: Lower total net worth
  - But $3.2M fully liquid
  - More flexibility

**Crossover point:** Around year 10-12, total net worth becomes higher for buying.

**Which is better?**
- Want flexibility, may relocate, value liquidity? → **Rent**
- Want stability, forced savings, legacy to leave? → **Buy**
- Planning to downsize later? → **Buy** (sell big house, pocket cash, buy smaller)

**Factors not modeled:**
- Tax deduction for mortgage interest (not in this tool)
- Emotional value of ownership
- Control over property (renovations, pets, etc.)
- Risk of housing market decline
- Opportunity cost if home appreciates less than investments

---

### 📚 Student Loan Forgiveness (Tax Bomb)

**Scenario**: $100k student loans on 25-year Income-Driven Repayment plan

**Current situation:**
- Age: 28
- Student loans: $100k federal, 5% interest
- Income: $60k
- IDR payment: ~$300/month ($3.6k/year)
- Forgiveness year: 2049 (25 years from now)

**The Problem:**
After 25 years of payments, remaining balance is forgiven.
**BUT**: Forgiven amount is taxable as ordinary income!

**Setup:**

**Debts:**
- Student loan: $100k balance
- Federal loan
- IDR repayment plan
- 5% interest
- Forgiveness: 2049 (after 25 years)

**Milestones:**
- Year 2049: "Student Loan Forgiveness Tax Bomb"
  - Amount: $100,000
  - Check "Taxable" ✅ (forgiven debt is taxable income!)
  - Do NOT check "Windfall" ❌ (not real money, just a tax event)

**What Happens in 2049:**

**Without planning:**
```
Income: $80,000 (by then, with raises)
+ Forgiven debt: $100,000 (taxable!)
= Taxable income: $180,000
- Standard deduction: $29,200
= Taxable: $150,800

Federal taxes: ~$28,000 😱

But you didn't receive $100k!
You owe $28k in taxes with no cash windfall!
```

**With planning:**
- Build up Roth IRA in years before forgiveness
- Have $30k in Roth by 2049
- Withdraw from Roth (tax-free) to pay tax bill
- Engine automatically uses Roth during tax bomb year (avoids stacking more taxable income from traditional IRA)

**Debugging output shows:**
```
[4] WITHDRAWALS BY ACCOUNT TYPE:
  Total Withdrawn: $28,000
    taxable: $0      ← Empty by now
    traditional: $0  ← SKIPPED due to tax bomb! ✅
    roth: $28,000    ← Used Roth to pay taxes ✅
    hsa: $0
```

Smart engine avoids traditional accounts during tax bomb years!

**Alternative strategies:**
1. Pay off loans aggressively (avoid forgiveness entirely)
2. Save extra in years 20-25 to prepare for tax bomb
3. Have cash/taxable accounts available
4. Consider Roth conversions in low-income years before forgiveness

---

## 💾 Data Management

### 📤 Export to CSV

Two types of exports:

#### 1. Export Projection Data (Dashboard)
**What's included:**
- Year-by-year projections
- All cash flows
- Tax calculations
- Account balances
- Net worth

**Use cases:**
- Deep-dive analysis in Excel
- Create custom charts
- Share with financial advisor
- Track actual vs. projected over time
- Tax planning

**How to export:**
1. Go to Dashboard tab
2. Click "Export to CSV"
3. Opens in Excel/Numbers/Google Sheets

---

#### 2. Export Configuration (Settings)
**What's included:**
- All accounts
- All income streams
- All expenses
- All housing settings
- All debts
- All milestones
- All scenarios
- Withdrawal strategy
- Investment glide path
- Tax settings

**Use cases:**
- Backup your complete plan
- Share plan with spouse/advisor
- Version control (export before major changes)
- Restore if you mess up

**How to export:**
1. Go to Settings tab
2. Scroll to bottom
3. Click "Export Settings to CSV"
4. Save file somewhere safe

💡 **Pro tip**: Export your settings monthly as backups!

---

### 📥 Import from CSV

Restore a previously exported configuration.

**Compatible formats:**
- Excel (save as "CSV UTF-8")
- Numbers (export as "CSV UTF-8")
- Google Sheets (download as CSV)

**Important:**
- Must be a settings export (not a projection export)
- Contains sections: [SETTINGS], [ACCOUNTS], [INCOME], [EXPENSES], etc.
- Preserves all data exactly as it was

**How to import:**
1. Click "Import from CSV"
2. Select previously exported settings file
3. All data restored instantly
4. Review to confirm everything loaded

**Troubleshooting:**
If import fails:
- Check file encoding (must be UTF-8)
- Open in text editor, verify sections present: [SETTINGS], [ACCOUNTS], etc.
- Make sure you didn't accidentally open/save in Excel (can corrupt format)
- Try exporting again and use the fresh export

---

### 💻 Browser Storage

**Automatic saving:**
- Changes save immediately to browser localStorage
- No "save" button needed
- Persists across browser sessions
- Private (never sent to server)

**Limitations:**
- Data is browser-specific (Chrome vs. Firefox = separate)
- Cleared if you clear browser data
- Typically 5-10MB limit (plenty for this app)

**To clear data:**
1. Clear browser localStorage/site data, OR
2. Refresh page and start fresh, OR
3. Use browser DevTools → Application → Local Storage → Delete

**Best practice:**
- Export settings regularly as backups
- Don't rely solely on browser storage
- Use CSV exports for long-term storage

---

## 🛠️ Technical Details

### 💻 Technologies

**Frontend:**
- Pure HTML/CSS/JavaScript (no frameworks!)
- No build process, no dependencies, no compilation
- Just open `index.html` and go

**Libraries:**
- **Chart.js**: Interactive charts (Dashboard, Monte Carlo, Scenarios)
- **No jQuery, no React, no Vue**
- Vanilla JavaScript for maximum compatibility

**Storage:**
- Browser localStorage API
- Automatic persistence
- No backend, no database, no server

**Privacy:**
- 100% client-side execution
- No network requests (except library CDNs)
- No analytics, no tracking
- Your data never leaves your computer

---

### 🧮 Tax Calculations

**Tax brackets:**
- 2024 federal tax brackets (not inflation-adjusted)
- Standard deduction only ($14,600 single / $29,200 married)
- Progressive bracket calculations
- Does NOT include:
  - State and local taxes
  - Itemized deductions
  - Tax credits (child tax credit, etc.)
  - Alternative Minimum Tax (AMT)
  - Net Investment Income Tax (NIIT)

**Capital gains:**
- Simplified model
- Not separately tracked from ordinary income
- Real world: Long-term capital gains taxed at 0%, 15%, or 20%

**Social Security taxation:**
- Not modeled
- Real world: Up to 85% of Social Security benefits may be taxable

**For most people, federal taxes are the biggest component, so this model is reasonably accurate.**

---

### 📊 Investment Returns

**Calculation method:**
- Applied to **average balance** (mid-year approximation)
- More accurate than start-of-year or end-of-year methods

**Formula:**
```
Average Balance = Start Balance + 0.5 × (Contributions + Windfalls) - 0.5 × (Withdrawals)

Returns = Average Balance × Return Rate
```

**Why average balance?**
- Money contributed/withdrawn during the year shouldn't get a full year of returns
- Approximates continuous contributions/withdrawals
- More realistic than:
  - Start balance method: Overstates returns (assumes contributions at beginning)
  - End balance method: Understates returns (assumes withdrawals at beginning)

**Example:**
- Start: $100k
- Contributions: $20k (throughout year)
- Returns: 7%

**Start balance method:**
- Returns = $100k × 7% = $7k ❌ (ignores that $20k wasn't there all year)

**Average balance method:**
- Avg = $100k + 0.5 × $20k = $110k
- Returns = $110k × 7% = $7.7k ✅ (more accurate)

---

### 🎲 Monte Carlo Simulation

**How it works:**
1. Takes your expected return and volatility
2. Generates random returns for each year (normal distribution)
3. Runs complete projection with those returns
4. Repeats 1,000+ times
5. Sorts outcomes by percentile
6. Charts 10th, 50th, and 75th percentiles

**Random number generation:**
- Box-Muller transform for normally distributed returns
- Seeded RNG for reproducibility (same inputs = same outputs)

**Example:**
- Expected return: 7%
- Volatility: 15%
- Year 1: Random return might be -8% or +22% (within normal distribution)
- Year 2: Different random return
- After 30 years: Wildly different outcome
- Do this 1,000 times: Get distribution of outcomes

**Percentiles:**
- 10th: 900 simulations did better, 100 did worse
- 50th: Median (500 better, 500 worse)
- 75th: 250 did better, 750 did worse

---

### 🔒 Security & Privacy

**No data collection:**
- No analytics
- No tracking pixels
- No cookies
- No external requests (except library CDNs)

**Your data stays local:**
- All calculations in browser
- Storage in browser localStorage only
- No server uploads
- No cloud sync

**Open source:**
- View all code in `app.js`
- No obfuscation
- No hidden behavior
- Audit yourself!

**Best practices:**
- Regularly export backups
- Store backups securely (encrypted drive)
- Don't share exported CSVs (contain your financial info)
- Use on personal computer (not shared/public machines)

---

## ⚖️ Disclaimer

**This tool is for educational and planning purposes only. It is NOT financial advice.**

**Important limitations:**
- Projections are estimates based on assumptions
- Actual results WILL vary (markets are unpredictable)
- Simplified tax model (real taxes more complex)
- Does not account for:
  - State and local taxes
  - Medicare premiums (IRMAA)
  - Social Security taxation
  - Roth conversion strategies
  - Estate planning
  - Long-term care costs
  - Unexpected life events

**Recommendations:**
- ✅ Use this tool for directional planning
- ✅ Run multiple scenarios
- ✅ Stress test your assumptions
- ✅ Consult a qualified financial advisor for personalized advice
- ✅ Consult a CPA for tax planning
- ✅ Update regularly based on actual results

**Use at your own risk.**
- Past performance does not guarantee future results
- All investments involve risk
- You could lose money
- Plan conservatively

---

## 📞 Support & Feedback

**Found a bug?** Check the browser console (F12) for debugging output.

**Have a suggestion?** This is an open-source personal project!

**Repository:** [github.com/KBKScientist/FinancialPlanner](https://github.com/KBKScientist/FinancialPlanner)

**Known limitations:**
- No state/local taxes
- No Roth conversion modeling
- No Social Security optimization
- No estate planning features
- Capital gains vs. ordinary income simplified
- No tax-loss harvesting
- No charitable giving strategies

**Future enhancements?** (Maybe!)
- Roth conversion optimizer
- Social Security claiming strategy
- State tax support
- More granular asset allocation
- Historical backtesting
- Multiple household members

---

## 🎉 Final Thoughts

Financial planning doesn't have to be expensive or complicated.

**This tool gives you:**
- ✅ Professional-grade projections
- ✅ Tax-optimized withdrawal engine
- ✅ Monte Carlo simulation
- ✅ Scenario comparison
- ✅ Complete privacy
- ✅ Zero cost

**No subscription. No tracking. No BS.**

**Your financial independence journey is personal.** This tool helps you model it, stress-test it, and refine it until you're confident in your plan.

Now go build your future! 🚀

---

*Built with ❤️ for the financial independence community*

*Questions? Review this guide or check the console for debugging output.*

**Happy planning!** 🎯📈💰