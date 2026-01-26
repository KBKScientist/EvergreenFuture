# Financial Projection Lab

A comprehensive personal finance planning tool inspired by ProjectionLab. Run entirely in your browser with no subscription required!

## Features

### Core Functionality
- **Net Worth Projections**: Project your financial future up to 40 years with detailed year-by-year analysis
- **Monte Carlo Simulations**: Run probabilistic simulations to understand potential outcomes and success rates
- **Cash Flow Visualization**: Interactive Sankey-style diagrams showing income, expenses, and savings flow
- **Tax Calculations**: Federal tax projections with support for different filing statuses
- **Multiple Account Types**: Track checking, savings, investment, and retirement accounts
- **Income & Expense Management**: Define multiple income streams and expenses with growth rates
- **Life Milestones**: Plan for retirement, home purchases, education, travel, and more

### Key Capabilities
- **Flexible Time Horizons**: Set start and end dates for income and expenses
- **Growth Modeling**: Apply annual growth rates to income and expenses (inflation, raises, etc.)
- **Investment Returns**: Model different return rates and volatility for Monte Carlo analysis
- **Data Persistence**: Automatically saves to browser localStorage
- **Import/Export**: Save and load your financial plans as JSON files
- **Privacy-First**: All calculations run locally in your browser - no data sent to servers

## Getting Started

### Installation
1. Simply open `index.html` in any modern web browser
2. No installation, no dependencies, no build process required!

### Quick Start Guide

1. **Add Accounts**
   - Go to the "Accounts" tab
   - Click "+ Add Account"
   - Enter your current account balances and expected return rates
   - Add all your checking, savings, investment, and retirement accounts

2. **Define Income Sources**
   - Navigate to the "Income" tab
   - Add your salary, side income, passive income, etc.
   - Set frequency (monthly/annual) and growth rate
   - Specify when income starts and ends (e.g., salary ends at retirement)

3. **Track Expenses**
   - Go to the "Expenses" tab
   - Add all your regular expenses by category
   - Set growth rates (typically 2-3% for inflation)
   - Mark expenses that end at certain times (e.g., mortgage payoff)

4. **Plan Milestones**
   - Visit the "Milestones" tab
   - Add major life events like:
     - Retirement (when you stop working)
     - Home purchase (one-time cost)
     - Annual travel plans (recurring costs)
     - Education expenses
   - Each milestone can have both one-time and recurring costs

5. **View Your Projection**
   - Return to the "Dashboard" to see your net worth projection
   - Review the summary statistics
   - Examine the cash flow diagram

6. **Set Up Investment Glide Path (Optional but Recommended)**
   - Go to the "Monte Carlo" tab
   - Click "+ Add Time Period" to define how your investment allocation changes over time
   - Example:
     - Now to 2040: 8% return, 18% volatility (aggressive growth)
     - 2040 to 2055: 6% return, 12% volatility (moderate)
     - 2055+: 4% return, 6% volatility (conservative/preservation)
   - This simulates shifting from stocks to bonds as you age

7. **Run Monte Carlo Simulation**
   - Still in the "Monte Carlo" tab
   - Set number of simulations (1000+ recommended)
   - Click "Run Simulation"
   - View probability distribution showing best/worst/median outcomes
   - Check success rate and percentile ranges

8. **Check Tax Projections**
   - Visit the "Taxes" tab
   - Select your filing status
   - View projected taxes over time

## Example Scenario

Here's a sample scenario to get you started:

**Accounts:**
- Checking: $10,000
- Investment Account: $50,000 (7% return)
- 401k: $100,000 (7% return)

**Income:**
- Salary: $80,000/year (3% annual growth, until retirement)
- Social Security: $30,000/year (starts at age 67)

**Expenses:**
- Housing: $2,000/month (2% growth)
- Transportation: $500/month (2% growth)
- Food: $800/month (2.5% growth)
- Healthcare: $400/month (4% growth)
- Entertainment: $300/month (2% growth)

**Milestones:**
- Retirement at age 65 (salary ends)
- Annual travel: $5,000/year starting at retirement

## Technical Details

### Technologies Used
- Pure HTML, CSS, and JavaScript (no frameworks!)
- Chart.js for interactive charts
- D3.js for Sankey cash flow diagrams
- LocalStorage API for data persistence

### Monte Carlo Simulation
The Monte Carlo engine uses:
- Box-Muller transform for generating normally distributed returns
- Configurable expected return and volatility
- 1000+ simulation runs for statistical accuracy
- Percentile analysis (10th, 25th, 50th, 75th, 90th)

### Tax Calculations
- Uses 2024 federal tax brackets
- Supports Single, Married Filing Jointly, and Head of Household
- Progressive bracket calculations
- Can be extended to include state taxes

## Data Management

### Automatic Saving
Your data is automatically saved to your browser's localStorage whenever you make changes.

### Export Your Data
Click "Export" to download your financial plan as a JSON file. Store this securely as a backup.

### Import Data
Click "Load Data" to import a previously exported JSON file.

## Privacy & Security

- **100% Local**: All calculations happen in your browser
- **No Tracking**: No analytics, no cookies, no external requests
- **Your Data**: You control your data - export it anytime
- **No Account Required**: No registration, no login, no subscription

## Customization Ideas

Want to extend this tool? Here are some ideas:

1. **Add More Account Types**: HSAs, 529 plans, brokerage accounts
2. **State Tax Support**: Add state-specific tax calculations
3. **Asset Allocation**: Track different investment types (stocks, bonds, real estate)
4. **Goal Tracking**: Set financial goals and track progress
5. **What-If Scenarios**: Create and compare multiple scenarios
6. **Historical Backtesting**: Test your plan against historical market data
7. **Inflation Adjustment**: Adjust all values for inflation
8. **Social Security Calculator**: More sophisticated Social Security modeling

## Tips for Accurate Projections

1. **Be Realistic**: Use conservative estimates for returns (6-7% is reasonable)
2. **Include Volatility**: Markets fluctuate - use 15-20% volatility for stock-heavy portfolios
3. **Don't Forget Inflation**: Apply 2-3% growth to expenses
4. **Plan for Healthcare**: Healthcare costs grow faster than inflation (3-4%)
5. **Update Regularly**: Review and update your plan annually
6. **Consider Tax Advantages**: Mark 401k/IRA accounts as tax-advantaged
7. **Buffer for Emergencies**: Keep 6-12 months expenses in cash

## Browser Compatibility

Works best in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Free to use and modify for personal use. Built as an open alternative to subscription-based planning tools.

## Differences from ProjectionLab

This is a simplified version focusing on core functionality. ProjectionLab offers additional features like:
- More sophisticated tax modeling (state taxes, deductions, credits)
- Historical backtesting with actual market data
- More milestone types and customization
- Roth conversion planning
- 72(t)/SEPP distribution calculations
- Multi-currency support

However, this tool covers 80% of use cases and is completely free!

## Support

Found a bug or want to suggest a feature? Since this is a personal tool, feel free to modify the code directly. The structure is straightforward:

- `index.html` - Page structure and layout
- `styles.css` - All styling and visual design
- `app.js` - All functionality (data models, calculations, UI)

Happy planning! 🎯📈
