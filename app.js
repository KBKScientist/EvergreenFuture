// Data Model
class FinancialModel {
    constructor() {
        this.accounts = [];
        this.incomes = [];
        this.expenses = [];
        this.milestones = [];
        this.settings = {
            planStartYear: new Date().getFullYear(),
            projectionHorizon: 40, // years into the future
            inflation: 3.0,
            filingStatus: 'single',
            household: {
                personA: {
                    name: 'Person A',
                    birthYear: new Date().getFullYear() - 30,
                    retirementYear: new Date().getFullYear() + 35,
                    lifeExpectancy: 95,
                    socialSecurity: {
                        enabled: false,
                        annualAmount: 0,
                        startAge: 67
                    }
                },
                personB: null // null for single, object for couple
            },
            pension: {
                enabled: false,
                owner: 'personA',
                name: '',
                annualAmount: 0,
                startYear: new Date().getFullYear(),
                growth: 0
            }
        };
        // Housing - supports multiple rental periods and owned properties with date ranges
        this.housing = {
            rentalPeriods: [],
            // Each rental period: {
            //     id, name, monthlyRent, startYear, endYear,
            //     annualIncrease, securityDeposit
            // }
            ownedProperties: []
            // Each owned property: {
            //     id, name, purchaseYear, sellYear,
            //     purchasePrice, downPayment, loanAmount,
            //     interestRate, loanTermYears, monthlyPayment,
            //     propertyTaxRate, insuranceAnnual, hoaMonthly,
            //     maintenanceRate, appreciationRate,
            //     extraPaymentMonthly, lumpSumPayoffs: [{year, amount}],
            //     sellingCosts, closingCosts
            // }
        };

        // Debt tracking
        this.debts = {
            creditCards: [],  // { id, name, balance, apr, minimumPaymentPercent, extraPayment }
            loans: []  // { id, name, type, balance, interestRate, monthlyPayment, startYear, termYears }
        };

        this.investmentGlidePath = [
            { startYear: new Date().getFullYear(), expectedReturn: 7, volatility: 15 }
        ];
        this.withdrawalStrategy = {
            type: 'tax_optimized', // tax_optimized, fixed_percentage, fixed_amount, dynamic, rmd
            withdrawalPercentage: 4,
            fixedAmount: 40000,
            inflationAdjusted: true,
            dynamicInitialRate: 5,
            dynamicUpperGuardrail: 20,
            dynamicLowerGuardrail: 20,
            rmdStartAge: 73,
            withdrawalStartYear: null, // null = auto-calculate, or set explicit year
            autoWithdrawalStart: true, // true = derive from retirement, false = use explicit year
            withdrawalMode: 'as_needed', // 'always' = apply strategy regardless of surplus/deficit, 'as_needed' = only withdraw when needed
            // Tax optimization configuration
            taxOptimizedSequence: ['cash', 'taxable', 'traditional', 'roth', 'hsa']
        };
        this.scenarios = [];
        this.validationErrors = [];
    }

    addAccount(account) {
        // Normalize account type to standard categories
        const accountTypeMap = {
            'checking': 'cash',
            'savings': 'cash',
            'investment': 'taxable',
            'retirement': 'traditional', // default retirement type
            'taxable': 'taxable',
            'traditional': 'traditional',
            'roth': 'roth',
            'hsa': 'hsa',
            'cash': 'cash'
        };

        const normalizedType = accountTypeMap[account.type] || 'taxable';

        this.accounts.push({
            id: Date.now(),
            name: account.name,
            type: normalizedType, // cash, taxable, traditional, roth, hsa
            originalType: account.type, // preserve original for display
            balance: parseFloat(account.balance),
            interestRate: parseFloat(account.interestRate) || 0,
            taxAdvantaged: normalizedType === 'traditional' || normalizedType === 'roth' || normalizedType === 'hsa'
        });
    }

    addIncome(income) {
        this.incomes.push({
            id: Date.now(),
            name: income.name,
            amount: parseFloat(income.amount),
            frequency: income.frequency, // monthly, annual
            startYear: parseInt(income.startYear, 10),
            endYear: parseInt(income.endYear, 10) || null,
            category: income.category || 'salary',
            growth: parseFloat(income.growth) || 0,
            ownerId: income.ownerId || 'household', // 'personA', 'personB', 'household'
            phasedRetirement: income.phasedRetirement || null // null or { type: 'step_down' | 'linear_ramp', steps: [...] }
        });
    }

    addExpense(expense) {
        this.expenses.push({
            id: Date.now(),
            name: expense.name,
            amount: parseFloat(expense.amount),
            frequency: expense.frequency,
            startYear: parseInt(expense.startYear, 10),
            endYear: parseInt(expense.endYear, 10) || null,
            category: expense.category,
            growth: parseFloat(expense.growth) || 0
        });
    }

    addMilestone(milestone) {
        this.milestones.push({
            id: Date.now(),
            name: milestone.name,
            type: milestone.type, // retirement, home, travel, inheritance, other
            year: parseInt(milestone.year, 10),
            cost: parseFloat(milestone.cost) || 0,
            isPositive: milestone.isPositive || false, // true for windfalls like inheritance
            recurring: milestone.recurring || false,
            recurringAmount: parseFloat(milestone.recurringAmount) || 0,
            recurringInterval: parseInt(milestone.recurringInterval, 10) || 1, // every N years (default 1 = every year)
            recurringGrowth: parseFloat(milestone.recurringGrowth) || 0, // NEW: annual growth rate for recurring amount (e.g., 3% for inflation)
            ownerId: milestone.ownerId || 'household', // 'personA', 'personB', 'household'
            // Tax bomb support for student loan forgiveness, etc.
            isTaxable: milestone.isTaxable || false,
            taxableAmount: parseFloat(milestone.taxableAmount) || 0,
            taxCategory: milestone.taxCategory || null // 'loan_forgiveness', 'bonus', etc.
        });
    }

    addRentalPeriod(rental) {
        this.housing.rentalPeriods.push({
            id: Date.now(),
            name: rental.name || 'Rental',
            monthlyRent: parseFloat(rental.monthlyRent),
            startYear: parseInt(rental.startYear, 10),
            endYear: rental.endYear ? parseInt(rental.endYear, 10) : null, // null = ongoing
            annualIncrease: parseFloat(rental.annualIncrease) || 3.0, // rent inflation %
            securityDeposit: parseFloat(rental.securityDeposit) || 0
        });
    }

    addOwnedProperty(property) {
        const loanAmount = property.purchasePrice - property.downPayment;
        const monthlyInterestRate = property.interestRate / 100 / 12;
        const numPayments = property.loanTermYears * 12;

        // Calculate monthly mortgage payment (principal + interest only)
        let monthlyPayment = 0;
        if (loanAmount > 0 && property.interestRate > 0) {
            monthlyPayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numPayments)) /
                            (Math.pow(1 + monthlyInterestRate, numPayments) - 1);
        }

        this.housing.ownedProperties.push({
            id: Date.now(),
            name: property.name || 'Primary Residence',
            purchaseYear: parseInt(property.purchaseYear, 10),
            purchasePrice: parseFloat(property.purchasePrice),
            downPayment: parseFloat(property.downPayment),
            closingCosts: parseFloat(property.closingCosts) || 0,
            loanAmount: loanAmount,
            interestRate: parseFloat(property.interestRate),
            loanTermYears: parseInt(property.loanTermYears, 10),
            monthlyPayment: monthlyPayment,
            propertyTaxRate: parseFloat(property.propertyTaxRate) || 1.0, // % of home value annually
            insuranceAnnual: parseFloat(property.insuranceAnnual) || 0,
            hoaMonthly: parseFloat(property.hoaMonthly) || 0,
            maintenanceRate: parseFloat(property.maintenanceRate) || 1.0, // % of home value annually
            appreciationRate: parseFloat(property.appreciationRate) || 3.0,
            extraPaymentMonthly: parseFloat(property.extraPaymentMonthly) || 0,
            lumpSumPayoffs: property.lumpSumPayoffs || [], // [{year, amount}]
            sellYear: property.sellYear ? parseInt(property.sellYear, 10) : null,
            sellingCosts: parseFloat(property.sellingCosts) || 8.0 // % of sale price
        });
    }

    addCreditCard(card) {
        this.debts.creditCards.push({
            id: Date.now(),
            name: card.name || 'Credit Card',
            balance: parseFloat(card.balance),
            apr: parseFloat(card.apr),
            minimumPaymentPercent: parseFloat(card.minimumPaymentPercent) || 2.0, // % of balance
            extraPayment: parseFloat(card.extraPayment) || 0 // Fixed extra monthly payment
        });
    }

    addLoan(loan) {
        this.debts.loans.push({
            id: Date.now(),
            name: loan.name,
            type: loan.type, // 'auto', 'student', 'personal', 'other'
            balance: parseFloat(loan.balance),
            interestRate: parseFloat(loan.interestRate),
            monthlyPayment: parseFloat(loan.monthlyPayment),
            startYear: parseInt(loan.startYear, 10),
            termYears: parseInt(loan.termYears, 10) || null,
            payoffYear: loan.payoffYear ? parseInt(loan.payoffYear, 10) : null, // Optional: pay off loan in specific year
            forgiveYear: loan.forgiveYear ? parseInt(loan.forgiveYear, 10) : null, // Optional: forgiveness year (e.g., PSLF)
            forgivenessIsTaxable: loan.forgivenessIsTaxable || false, // Is forgiven amount taxable?
            forgivenessAmount: loan.forgivenessAmount ? parseFloat(loan.forgivenessAmount) : null // Specific forgiveness amount, or null for remaining balance
        });
    }

    removeItem(array, id) {
        const index = array.findIndex(item => item.id === id);
        if (index > -1) {
            array.splice(index, 1);
        }
    }

    validate() {
        this.validationErrors = [];
        const currentYear = this.settings.planStartYear;

        // Validate household members
        const personA = this.settings.household.personA;
        if (!personA.birthYear || personA.birthYear > currentYear) {
            this.validationErrors.push({
                type: 'error',
                message: 'Person A birth year is missing or invalid',
                field: 'personA.birthYear'
            });
        }

        if (!personA.retirementYear || personA.retirementYear < currentYear) {
            this.validationErrors.push({
                type: 'error',
                message: 'Person A retirement year must be in the future',
                field: 'personA.retirementYear'
            });
        }

        const personAAge = currentYear - personA.birthYear;
        const personARetirementAge = personA.retirementYear - personA.birthYear;

        if (personARetirementAge < personAAge) {
            this.validationErrors.push({
                type: 'error',
                message: `Person A retirement age (${personARetirementAge}) is before current age (${personAAge})`,
                field: 'personA.retirementYear'
            });
        }

        if (personA.lifeExpectancy < personARetirementAge) {
            this.validationErrors.push({
                type: 'warning',
                message: `Person A life expectancy (${personA.lifeExpectancy}) is before retirement age (${personARetirementAge})`,
                field: 'personA.lifeExpectancy'
            });
        }

        // Validate Person B if exists
        if (this.settings.household.personB) {
            const personB = this.settings.household.personB;
            if (!personB.birthYear || personB.birthYear > currentYear) {
                this.validationErrors.push({
                    type: 'error',
                    message: 'Person B birth year is missing or invalid',
                    field: 'personB.birthYear'
                });
            }

            if (!personB.retirementYear || personB.retirementYear < currentYear) {
                this.validationErrors.push({
                    type: 'error',
                    message: 'Person B retirement year must be in the future',
                    field: 'personB.retirementYear'
                });
            }

            if (this.settings.filingStatus === 'single') {
                this.validationErrors.push({
                    type: 'warning',
                    message: 'Two household members defined but filing status is Single',
                    field: 'filingStatus'
                });
            }
        }

        // Validate income/expense date ranges
        this.incomes.forEach(income => {
            if (income.startYear && income.endYear && income.startYear > income.endYear) {
                this.validationErrors.push({
                    type: 'error',
                    message: `Income "${income.name}" start year is after end year`,
                    field: `income.${income.id}`
                });
            }

            if (income.startYear && income.startYear < currentYear - 50) {
                this.validationErrors.push({
                    type: 'warning',
                    message: `Income "${income.name}" has unusual start year (${income.startYear})`,
                    field: `income.${income.id}`
                });
            }
        });

        this.expenses.forEach(expense => {
            if (expense.startYear && expense.endYear && expense.startYear > expense.endYear) {
                this.validationErrors.push({
                    type: 'error',
                    message: `Expense "${expense.name}" start year is after end year`,
                    field: `expense.${expense.id}`
                });
            }
        });

        // Validate milestones are in reasonable range
        this.milestones.forEach(milestone => {
            if (milestone.year < currentYear) {
                this.validationErrors.push({
                    type: 'warning',
                    message: `Milestone "${milestone.name}" is in the past (${milestone.year})`,
                    field: `milestone.${milestone.id}`
                });
            }

            if (milestone.year > currentYear + this.settings.projectionHorizon) {
                this.validationErrors.push({
                    type: 'warning',
                    message: `Milestone "${milestone.name}" is beyond projection horizon`,
                    field: `milestone.${milestone.id}`
                });
            }
        });

        // Check for missing critical data
        if (this.accounts.length === 0) {
            this.validationErrors.push({
                type: 'warning',
                message: 'No accounts defined - add at least one account to track net worth',
                field: 'accounts'
            });
        }

        // Validate account balances sum correctly
        const totalBalance = this.accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const liquidCash = this.accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.balance, 0);
        const investments = this.accounts.filter(a => ['taxable', 'traditional', 'roth', 'hsa'].includes(a.type)).reduce((sum, a) => sum + a.balance, 0);
        const breakdownSum = liquidCash + investments;
        if (Math.abs(breakdownSum - totalBalance) > 1) {
            this.validationErrors.push({
                type: 'error',
                message: `Account breakdown mismatch: total=${totalBalance.toFixed(2)}, cash+investments=${breakdownSum.toFixed(2)}`,
                field: 'accounts'
            });
        }

        if (this.incomes.length === 0) {
            this.validationErrors.push({
                type: 'warning',
                message: 'No income sources defined',
                field: 'incomes'
            });
        }

        // Check for missing retirement income sources
        const retirementYear = this.settings.household.personA.retirementYear;
        const hasRetirementIncome = this.incomes.some(inc => {
            const isRetirementCategory = ['pension', 'social_security', 'investment', 'rental'].includes(inc.category);
            const activeInRetirement = (!inc.endYear || inc.endYear >= retirementYear) &&
                                      inc.startYear <= retirementYear + 5; // within 5 years of retirement
            return isRetirementCategory && activeInRetirement;
        });

        // Check if income goes to zero in any future year without retirement income
        const futureYears = 10; // Check next 10 years
        for (let i = 0; i < futureYears; i++) {
            const checkYear = currentYear + i;
            let yearIncome = 0;

            this.incomes.forEach(inc => {
                if (checkYear >= inc.startYear && (!inc.endYear || checkYear <= inc.endYear)) {
                    const multiplier = inc.frequency === 'monthly' ? 12 : 1;
                    yearIncome += inc.amount * multiplier;
                }
            });

            if (yearIncome === 0 && !hasRetirementIncome) {
                this.validationErrors.push({
                    type: 'warning',
                    message: `Income drops to $0 in year ${checkYear} with no retirement income sources (Social Security, pension, annuity)`,
                    field: 'incomes'
                });
                break; // Only warn once
            }
        }

        // Check for healthcare expense category
        const hasHealthcare = this.expenses.some(exp => exp.category === 'healthcare');
        const currentPersonAAge = currentYear - this.settings.household.personA.birthYear;
        if (!hasHealthcare && currentPersonAAge > 50) {
            this.validationErrors.push({
                type: 'warning',
                message: 'No healthcare expense category defined - especially important for early retirement (Medicare starts at 65)',
                field: 'expenses'
            });
        }

        return {
            valid: this.validationErrors.filter(e => e.type === 'error').length === 0,
            errors: this.validationErrors.filter(e => e.type === 'error'),
            warnings: this.validationErrors.filter(e => e.type === 'warning')
        };
    }
}

// Projection Engine
class ProjectionEngine {
    constructor(model) {
        this.model = model;
    }

    calculateNetWorth(year) {
        let netWorth = 0;
        this.model.accounts.forEach(account => {
            netWorth += account.balance;
        });
        return netWorth;
    }

    getWithdrawalStartYear() {
        // If auto-calculation is disabled, use explicit year
        if (!this.model.withdrawalStrategy.autoWithdrawalStart && this.model.withdrawalStrategy.withdrawalStartYear) {
            return this.model.withdrawalStrategy.withdrawalStartYear;
        }

        // Otherwise, derive from earliest retirement year or when income < expenses
        const personA = this.model.settings.household.personA;
        const personB = this.model.settings.household.personB;

        // Start with earliest retirement year
        let withdrawalYear = personA.retirementYear;
        if (personB && personB.retirementYear < withdrawalYear) {
            withdrawalYear = personB.retirementYear;
        }

        // Check if income drops below expenses before retirement
        const currentYear = this.model.settings.planStartYear;
        for (let year = currentYear; year < withdrawalYear; year++) {
            let annualIncome = 0;
            this.model.incomes.forEach(income => {
                if (year >= income.startYear && (!income.endYear || year <= income.endYear)) {
                    const yearsSinceStart = year - income.startYear;
                    const adjustedAmount = income.amount * Math.pow(1 + income.growth / 100, yearsSinceStart);
                    annualIncome += income.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                }
            });

            // Add retirement income - Social Security for Person A
            // Social Security includes COLA (Cost of Living Adjustment), typically ~2-3% annually
            const personA = this.model.settings.household.personA;
            if (personA.socialSecurity && personA.socialSecurity.enabled) {
                const personAAge = year - personA.birthYear;
                if (personAAge >= personA.socialSecurity.startAge) {
                    const startYear = personA.birthYear + personA.socialSecurity.startAge;
                    const yearsSinceSSStart = Math.max(0, year - startYear);
                    // Apply inflation adjustment (COLA) to Social Security
                    const inflationRate = this.model.settings.inflation / 100;
                    const adjustedSS = personA.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                    annualIncome += adjustedSS;
                }
            }

            // Add retirement income - Social Security for Person B
            const personB = this.model.settings.household.personB;
            if (personB && personB.socialSecurity && personB.socialSecurity.enabled) {
                const personBAge = year - personB.birthYear;
                if (personBAge >= personB.socialSecurity.startAge) {
                    const startYear = personB.birthYear + personB.socialSecurity.startAge;
                    const yearsSinceSSStart = Math.max(0, year - startYear);
                    // Apply inflation adjustment (COLA) to Social Security
                    const inflationRate = this.model.settings.inflation / 100;
                    const adjustedSS = personB.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                    annualIncome += adjustedSS;
                }
            }

            // Add retirement income - Pension
            const pension = this.model.settings.pension;
            if (pension && pension.enabled && year >= pension.startYear) {
                const yearsSinceStart = year - pension.startYear;
                const adjustedPension = pension.annualAmount * Math.pow(1 + pension.growth / 100, yearsSinceStart);
                annualIncome += adjustedPension;
            }

            let annualExpenses = 0;
            this.model.expenses.forEach(expense => {
                if (year >= expense.startYear && (!expense.endYear || year <= expense.endYear)) {
                    const yearsSinceStart = year - expense.startYear;
                    const adjustedAmount = expense.amount * Math.pow(1 + expense.growth / 100, yearsSinceStart);
                    annualExpenses += expense.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                }
            });

            if (annualIncome < annualExpenses && annualIncome > 0) {
                // Income exists but doesn't cover expenses - start withdrawals
                withdrawalYear = year;
                break;
            }
        }

        return withdrawalYear;
    }

    getTotalBalance(accountBalances) {
        return accountBalances.reduce((sum, acc) => sum + acc.balance, 0);
    }

    getAccountsByType(accountBalances, type) {
        return accountBalances.filter(acc => acc.type === type);
    }

    getTotalByType(accountBalances, type) {
        return this.getAccountsByType(accountBalances, type)
            .reduce((sum, acc) => sum + acc.balance, 0);
    }

    projectNetWorth(years = 40) {
        const projections = [];
        const currentYear = this.model.settings.planStartYear;
        const withdrawalStartYear = this.getWithdrawalStartYear();

        // Track each account individually for tax-optimized withdrawals
        let accountBalances = this.model.accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            balance: acc.balance,
            interestRate: acc.interestRate
        }));
        let initialPortfolioAtWithdrawal = null;
        let previousWithdrawal = 0;
        let yearsSinceWithdrawalStart = 0;

        for (let i = 0; i <= years; i++) {
            const year = currentYear + i;
            const startBalance = this.getTotalBalance(accountBalances);

            // Calculate annual income
            let annualIncome = 0;
            this.model.incomes.forEach(income => {
                if (year >= income.startYear && (!income.endYear || year <= income.endYear)) {
                    const yearsSinceStart = year - income.startYear;
                    const adjustedAmount = income.amount * Math.pow(1 + income.growth / 100, yearsSinceStart);
                    annualIncome += income.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                }
            });

            // Add retirement income - Social Security for Person A
            // Social Security includes COLA (Cost of Living Adjustment), typically ~2-3% annually
            const personA = this.model.settings.household.personA;
            if (personA.socialSecurity && personA.socialSecurity.enabled) {
                const personAAge = year - personA.birthYear;
                if (personAAge >= personA.socialSecurity.startAge) {
                    const startYear = personA.birthYear + personA.socialSecurity.startAge;
                    const yearsSinceSSStart = Math.max(0, year - startYear);
                    // Apply inflation adjustment (COLA) to Social Security
                    const inflationRate = this.model.settings.inflation / 100;
                    const adjustedSS = personA.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                    annualIncome += adjustedSS;
                }
            }

            // Add retirement income - Social Security for Person B
            const personB = this.model.settings.household.personB;
            if (personB && personB.socialSecurity && personB.socialSecurity.enabled) {
                const personBAge = year - personB.birthYear;
                if (personBAge >= personB.socialSecurity.startAge) {
                    const startYear = personB.birthYear + personB.socialSecurity.startAge;
                    const yearsSinceSSStart = Math.max(0, year - startYear);
                    // Apply inflation adjustment (COLA) to Social Security
                    const inflationRate = this.model.settings.inflation / 100;
                    const adjustedSS = personB.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                    annualIncome += adjustedSS;
                }
            }

            // Add retirement income - Pension
            const pension = this.model.settings.pension;
            if (pension && pension.enabled && year >= pension.startYear) {
                const yearsSinceStart = year - pension.startYear;
                const adjustedPension = pension.annualAmount * Math.pow(1 + pension.growth / 100, yearsSinceStart);
                annualIncome += adjustedPension;
            }

            // Calculate annual expenses
            let annualExpenses = 0;
            this.model.expenses.forEach(expense => {
                if (year >= expense.startYear && (!expense.endYear || year <= expense.endYear)) {
                    const yearsSinceStart = year - expense.startYear;
                    const adjustedAmount = expense.amount * Math.pow(1 + expense.growth / 100, yearsSinceStart);
                    annualExpenses += expense.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                }
            });

            // Calculate housing costs for this year (broken down by component)
            // New model: supports multiple rental periods and owned properties simultaneously
            let housingCosts = 0;
            let homeValue = 0;
            let mortgageBalance = 0;
            let rentCost = 0;
            let mortgageCost = 0;
            let propertyTaxCost = 0;
            let insuranceCost = 0;
            let hoaCost = 0;
            let maintenanceCost = 0;

            // Calculate rent costs from all active rental periods
            if (year === this.model.settings.planStartYear) {
                console.log(`🏠 Housing data:`, {
                    rentalPeriods: this.model.housing.rentalPeriods,
                    rentalPeriodsLength: this.model.housing.rentalPeriods?.length || 0,
                    ownedProperties: this.model.housing.ownedProperties?.length || 0
                });
            }

            if (this.model.housing.rentalPeriods && this.model.housing.rentalPeriods.length > 0) {
                if (year === this.model.settings.planStartYear) {
                    console.log(`Checking ${this.model.housing.rentalPeriods.length} rental periods for year ${year}`);
                }

                this.model.housing.rentalPeriods.forEach(rental => {
                    if (year === this.model.settings.planStartYear) {
                        console.log(`Rental "${rental.name}": startYear=${rental.startYear}, endYear=${rental.endYear}, monthlyRent=${rental.monthlyRent}`);
                    }

                    if (year >= rental.startYear && (!rental.endYear || year <= rental.endYear)) {
                        const yearsSinceStart = year - rental.startYear;
                        const adjustedRent = rental.monthlyRent * Math.pow(1 + rental.annualIncrease / 100, yearsSinceStart);
                        const annualRent = adjustedRent * 12;
                        rentCost += annualRent;
                        housingCosts += annualRent;

                        if (year === this.model.settings.planStartYear) {
                            console.log(`✅ Rental period "${rental.name}" ACTIVE: $${Math.round(adjustedRent)}/mo = $${Math.round(annualRent)}/yr`);
                        }
                    }
                });
            }

            // Calculate costs from all owned properties
            if (this.model.housing.ownedProperties && this.model.housing.ownedProperties.length > 0) {
                if (year === this.model.settings.planStartYear) {
                    console.log(`Found ${this.model.housing.ownedProperties.length} owned properties`);
                }

                this.model.housing.ownedProperties.forEach(property => {
                    if (year >= property.purchaseYear && (!property.sellYear || year < property.sellYear)) {
                        if (year === this.model.settings.planStartYear) {
                            console.log(`Property "${property.name}" active in year ${year}, purchase year: ${property.purchaseYear}`);
                            console.log(`Property data: loanAmount=${property.loanAmount}, monthlyPayment=${property.monthlyPayment}, interestRate=${property.interestRate}, loanTermYears=${property.loanTermYears}`);
                        }

                        // Calculate current home value with appreciation
                        const currentHomeValue = this.calculateHomeValueForYear(property, year);
                        const mortgageData = this.calculateMortgageBalanceForYear(property, year);

                        if (year === this.model.settings.planStartYear) {
                            console.log(`Mortgage data: balance=${mortgageData.balance}, monthlyPayment=${mortgageData.monthlyPayment}`);
                        }

                        // Calculate housing costs broken down
                        const monthlyPayment = mortgageData.monthlyPayment || 0;
                        const propertyTax = currentHomeValue * (property.propertyTaxRate / 100);
                        const insurance = property.insuranceAnnual || 0;
                        const hoa = (property.hoaMonthly || 0) * 12;
                        const maintenance = currentHomeValue * (property.maintenanceRate / 100);

                        mortgageCost += monthlyPayment * 12;
                        propertyTaxCost += propertyTax;
                        insuranceCost += insurance;
                        hoaCost += hoa;
                        maintenanceCost += maintenance;

                        const propertyCosts = (monthlyPayment * 12) + propertyTax + insurance + hoa + maintenance;
                        housingCosts += propertyCosts;

                        if (year === this.model.settings.planStartYear) {
                            console.log(`Housing costs for "${property.name}" in ${year}: mortgage=$${monthlyPayment * 12}, propertyTax=$${propertyTax}, insurance=$${insurance}, hoa=$${hoa}, maintenance=$${maintenance}, total=$${propertyCosts}`);
                        }

                        homeValue += currentHomeValue;
                        mortgageBalance += mortgageData.balance;
                    }
                });
            }

            // Calculate debt payments and balances
            const debtData = this.calculateDebtCostsForYear(year);

            // Add housing and debt costs to annual expenses
            annualExpenses += housingCosts + debtData.totalPayment;

            // Handle home purchase closing costs and home sales
            let homePurchaseCosts = 0;
            let homeSaleProceeds = 0;
            this.model.housing.ownedProperties.forEach(property => {
                // Closing costs in purchase year (down payment + closing costs)
                if (year === property.purchaseYear) {
                    homePurchaseCosts += (property.downPayment || 0) + (property.closingCosts || 0);
                }

                // Home sale proceeds
                if (property.sellYear && year === property.sellYear) {
                    const saleHomeValue = this.calculateHomeValueForYear(property, year);
                    const saleMortgageBalance = this.calculateMortgageBalanceForYear(property, year).balance;
                    const sellingCostsAmount = saleHomeValue * ((property.sellingCosts || 8) / 100);
                    const netProceeds = saleHomeValue - saleMortgageBalance - sellingCostsAmount;
                    homeSaleProceeds += netProceeds;
                }
            });

            // Check for milestone costs and windfalls
            let milestoneCosts = 0;
            let milestoneWindfalls = 0;
            let milestoneTaxableIncome = 0; // Tax bombs (e.g., student loan forgiveness)
            this.model.milestones.forEach(milestone => {
                if (milestone.year === year) {
                    if (milestone.isPositive) {
                        milestoneWindfalls += milestone.cost;
                    } else {
                        milestoneCosts += milestone.cost;
                    }
                    // Check for taxable events (e.g., student loan forgiveness)
                    if (milestone.isTaxable) {
                        milestoneTaxableIncome += milestone.taxableAmount;
                    }
                }
                // Handle recurring milestones with interval (e.g., every 8 years)
                if (milestone.recurring && year >= milestone.year) {
                    const yearsSinceStart = year - milestone.year;
                    const interval = milestone.recurringInterval || 1;

                    // Check if this year matches the interval (e.g., year 0, 8, 16, 24...)
                    if (yearsSinceStart % interval === 0) {
                        // Apply growth rate to recurring amount
                        // Growth compounds from the start year, not from each occurrence
                        const growthRate = (milestone.recurringGrowth || 0) / 100;
                        const adjustedAmount = milestone.recurringAmount * Math.pow(1 + growthRate, yearsSinceStart);

                        if (milestone.isPositive) {
                            milestoneWindfalls += adjustedAmount;
                        } else {
                            milestoneCosts += adjustedAmount;
                        }
                    }
                }
            });

            // FIRST PASS: Calculate taxes on earned income only
            // (We'll recalculate after withdrawals to include Traditional IRA/401k taxation)
            const filingStatus = this.model.settings.filingStatus;
            // Include debt forgiveness as taxable income (e.g., student loan forgiveness)
            const debtTaxableIncome = debtData.totalTaxableIncome || 0;
            let annualTaxes = this.calculateTaxes(annualIncome + milestoneTaxableIncome + debtTaxableIncome, filingStatus);

            // Calculate net cash flow (separating regular contributions from windfalls)
            // Income - Taxes - Expenses - Milestone Costs - Home Purchase Costs = Regular Savings
            const regularSavings = annualIncome - annualTaxes - annualExpenses - milestoneCosts - homePurchaseCosts;
            const netCashFlow = regularSavings + milestoneWindfalls + homeSaleProceeds; // Total including windfalls and home sales

            // Determine contributions or withdrawals needed
            let contributions = 0; // Regular contributions from income-expenses
            let windfallContributions = 0; // Separate tracking for windfalls
            let withdrawals = 0;
            let withdrawalShortfall = 0;
            let traditionalWithdrawals = 0; // Track traditional withdrawals for tax calculation
            let withdrawalsByType = {}; // Track withdrawals by account type for Sankey diagram

            if (netCashFlow > 0) {
                // Surplus - separate regular contributions from windfalls
                if (regularSavings > 0) {
                    contributions = regularSavings;
                    windfallContributions = milestoneWindfalls;
                } else {
                    // Windfall covers the deficit
                    contributions = 0;
                    windfallContributions = netCashFlow; // What's left after covering deficit
                }
            } else if (netCashFlow < 0) {
                // Deficit - need to withdraw from portfolio
                let neededWithdrawal = Math.abs(netCashFlow);

                // CRITICAL FIX: Account for taxes on withdrawals (circular dependency)
                // We need to iteratively solve for the withdrawal amount that covers:
                // 1. The deficit (expenses + taxes - income)
                // 2. Additional taxes created by taxable withdrawals (from traditional accounts)

                // Estimate traditional withdrawal percentage based on current portfolio composition
                const totalBalance = this.getTotalBalance(accountBalances);
                const traditionalBalance = this.getTotalByType(accountBalances, 'traditional');
                const traditionalPercentage = totalBalance > 0 ? traditionalBalance / totalBalance : 0;

                // Iteratively solve for withdrawal amount (max 5 iterations)
                let iterationCount = 0;
                let converged = false;

                while (!converged && iterationCount < 5) {
                    // Estimate how much of the withdrawal will be from traditional accounts
                    const estimatedTraditionalWithdrawal = neededWithdrawal * traditionalPercentage;

                    // Calculate total taxable income including estimated traditional withdrawal and debt taxable income
                    const estimatedTaxableIncome = annualIncome + milestoneTaxableIncome + debtTaxableIncome + estimatedTraditionalWithdrawal;
                    const estimatedTotalTaxes = this.calculateTaxes(estimatedTaxableIncome, filingStatus);

                    // Calculate new deficit including the higher taxes
                    const newDeficit = annualExpenses + milestoneCosts + estimatedTotalTaxes - annualIncome;

                    // Check if we've converged (within $1)
                    if (Math.abs(newDeficit - neededWithdrawal) < 1) {
                        converged = true;
                    } else {
                        neededWithdrawal = newDeficit;
                        iterationCount++;
                    }
                }

                // Also check if we're past withdrawal start year and need additional strategic withdrawals
                if (year >= withdrawalStartYear) {
                    if (initialPortfolioAtWithdrawal === null) {
                        initialPortfolioAtWithdrawal = totalBalance;
                        yearsSinceWithdrawalStart = 0;
                    } else {
                        yearsSinceWithdrawalStart++;
                    }

                    const strategicWithdrawal = this.calculateWithdrawal(
                        year,
                        totalBalance,
                        initialPortfolioAtWithdrawal,
                        previousWithdrawal,
                        yearsSinceWithdrawalStart
                    );

                    // Respect withdrawalMode: if "as_needed", only take what's needed (deficit)
                    // If any other mode, take max of deficit or strategic withdrawal (traditional 4% rule behavior)
                    if (this.model.withdrawalStrategy.withdrawalMode === 'as_needed') {
                        withdrawals = neededWithdrawal; // Only withdraw what's needed, ignore strategic amount
                    } else {
                        withdrawals = Math.max(neededWithdrawal, strategicWithdrawal); // Traditional: ensure minimum withdrawal
                    }

                    previousWithdrawal = withdrawals;
                } else {
                    // Before withdrawal start year, only withdraw what's needed for deficit
                    withdrawals = neededWithdrawal;
                }

                // Check if we have enough assets
                if (withdrawals > totalBalance) {
                    withdrawalShortfall = withdrawals - totalBalance;
                    withdrawals = totalBalance; // Can only withdraw what we have
                }
            } else if (year >= withdrawalStartYear && this.model.withdrawalStrategy.withdrawalMode === 'always') {
                // No deficit but past withdrawal start - apply strategic withdrawal (only if mode is 'always')
                const totalBalance = this.getTotalBalance(accountBalances);
                console.log(`Year ${year}: Surplus income but applying strategic withdrawal anyway (mode='always', balance=$${totalBalance.toLocaleString()})`);
                if (initialPortfolioAtWithdrawal === null) {
                    initialPortfolioAtWithdrawal = totalBalance;
                    yearsSinceWithdrawalStart = 0;
                } else {
                    yearsSinceWithdrawalStart++;
                }

                withdrawals = this.calculateWithdrawal(
                    year,
                    totalBalance,
                    initialPortfolioAtWithdrawal,
                    previousWithdrawal,
                    yearsSinceWithdrawalStart
                );

                if (withdrawals > totalBalance) {
                    withdrawalShortfall = withdrawals - totalBalance;
                    withdrawals = totalBalance;
                }

                previousWithdrawal = withdrawals;
            }

            // Get the appropriate return rate for this year from glide path
            let returnRate = 0.07; // Default 7% if no glide path
            if (this.model.investmentGlidePath && this.model.investmentGlidePath.length > 0) {
                let applicableSegment = this.model.investmentGlidePath[0];
                for (let j = this.model.investmentGlidePath.length - 1; j >= 0; j--) {
                    if (year >= this.model.investmentGlidePath[j].startYear) {
                        applicableSegment = this.model.investmentGlidePath[j];
                        break;
                    }
                }
                returnRate = applicableSegment.expectedReturn / 100;
            }

            // CRITICAL FIX: Apply returns to each account based on its type
            // - Cash accounts: use their fixed interest rate (typically 3-5%)
            // - Investment accounts (taxable, traditional, roth, hsa): use glide path rate (8% → 6% → 4%)
            let totalInvestmentReturns = 0;
            accountBalances.forEach(acc => {
                let accountReturnRate;

                if (acc.type === 'cash') {
                    // Cash/savings accounts: use account-specific rate (doesn't follow glide path)
                    accountReturnRate = acc.interestRate / 100;
                } else {
                    // Investment accounts: use glide path rate (changes over time based on risk tolerance)
                    accountReturnRate = returnRate;
                }

                // Apply this account's return rate to its current balance
                const accountReturns = acc.balance * accountReturnRate;
                acc.balance += accountReturns;
                totalInvestmentReturns += accountReturns;
            });

            // Apply contributions
            // Regular contributions (from salary) - distribute proportionally to maintain allocation
            if (contributions > 0) {
                const totalBalance = this.getTotalBalance(accountBalances);
                if (totalBalance > 0) {
                    accountBalances.forEach(acc => {
                        const proportion = acc.balance / totalBalance;
                        acc.balance += contributions * proportion;
                    });
                } else {
                    // If zero balance, add to first account
                    if (accountBalances.length > 0) {
                        accountBalances[0].balance += contributions;
                    }
                }
            }

            // Windfalls (inheritance, gifts, etc.) - only go to taxable/cash accounts, not retirement accounts
            if (windfallContributions > 0) {
                // Find taxable and cash accounts
                const taxableAccounts = accountBalances.filter(acc =>
                    acc.type === 'taxable' || acc.type === 'cash'
                );

                if (taxableAccounts.length > 0) {
                    // Distribute proportionally among taxable/cash accounts only
                    const taxableTotalBalance = taxableAccounts.reduce((sum, acc) => sum + acc.balance, 0);

                    if (taxableTotalBalance > 0) {
                        taxableAccounts.forEach(acc => {
                            const proportion = acc.balance / taxableTotalBalance;
                            acc.balance += windfallContributions * proportion;
                        });
                    } else {
                        // If all taxable accounts are empty, distribute evenly
                        const perAccount = windfallContributions / taxableAccounts.length;
                        taxableAccounts.forEach(acc => {
                            acc.balance += perAccount;
                        });
                    }
                } else {
                    // No taxable accounts - add to first account as fallback (shouldn't happen)
                    console.warn(`Year ${year}: No taxable/cash accounts found for windfall - adding to first account`);
                    if (accountBalances.length > 0) {
                        accountBalances[0].balance += windfallContributions;
                    }
                }
            }

            // Apply withdrawals using tax-optimized sequence (after retirement) or proportionally (before retirement)
            if (withdrawals > 0) {
                if (year >= withdrawalStartYear) {
                    // Detect tax bomb year - if so, adjust withdrawal sequence to minimize taxes
                    let customSequence = null;
                    const totalTaxBombs = milestoneTaxableIncome + debtTaxableIncome;
                    if (totalTaxBombs > 0) {
                        // Tax bomb detected! Skip traditional accounts to avoid stacking taxable income
                        // Sequence: cash → taxable → roth → hsa → traditional (traditional as last resort)
                        customSequence = ['cash', 'taxable', 'roth', 'hsa', 'traditional'];
                        console.log(`Year ${year}: TAX BOMB DETECTED ($${totalTaxBombs.toLocaleString()}) - Using Roth-first sequence`);
                    }

                    // Use tax-optimized withdrawal sequence for ALL withdrawal types after retirement
                    const withdrawalDetails = this.executeWithdrawalSequence(
                        accountBalances,
                        withdrawals,
                        year,
                        customSequence ? { forceTypes: customSequence } : {}
                    );

                    // Update tracking variables
                    withdrawals = withdrawalDetails.totalWithdrawn;
                    withdrawalShortfall = withdrawalDetails.shortfall;
                    traditionalWithdrawals = withdrawalDetails.byType['traditional'] || 0;

                    // Store full withdrawal breakdown for Sankey diagram
                    withdrawalsByType = withdrawalDetails.byType;

                } else {
                    // Before retirement or using old strategy: withdraw proportionally
                    const totalBalance = this.getTotalBalance(accountBalances);

                    // FIX: Protect against division by zero
                    if (totalBalance <= 0) {
                        traditionalWithdrawals = 0;
                        withdrawalShortfall = withdrawals; // Can't withdraw from empty accounts
                        withdrawals = 0;
                        withdrawalsByType = {};
                    } else {
                        // Withdraw proportionally from all accounts
                        // CRITICAL: Use the SAME total balance for both proportion calculation and actual withdrawal
                        // to ensure withdrawals sum to the target amount

                        withdrawalsByType = {};
                        let actualTotalWithdrawn = 0;

                        accountBalances.forEach(acc => {
                            const proportion = acc.balance / totalBalance;
                            const amountFromAccount = withdrawals * proportion;

                            // Track by type for Sankey
                            if (!withdrawalsByType[acc.type]) {
                                withdrawalsByType[acc.type] = 0;
                            }
                            withdrawalsByType[acc.type] += amountFromAccount;
                            actualTotalWithdrawn += amountFromAccount;

                            // Deduct from account
                            acc.balance -= amountFromAccount;
                        });

                        traditionalWithdrawals = withdrawalsByType.traditional || 0;
                    }
                }
            }

            // ENFORCE RMDs: Check if we need to take Required Minimum Distributions
            // RMDs are mandatory regardless of withdrawal strategy type
            const personAAge = year - this.model.settings.household.personA.birthYear;
            const rmdStartAge = this.model.withdrawalStrategy.rmdStartAge || 73;

            if (personAAge >= rmdStartAge) {
                // Calculate RMD from traditional accounts only
                const traditionalBalance = this.getTotalByType(accountBalances, 'traditional');
                if (traditionalBalance > 0) {
                    const rmdDivisor = this.getRMDDivisor(personAAge);
                    const requiredRMD = traditionalBalance / rmdDivisor;

                    // If we haven't withdrawn enough from traditional accounts, force additional withdrawal
                    if (traditionalWithdrawals < requiredRMD) {
                        const additionalRMD = requiredRMD - traditionalWithdrawals;

                        // Withdraw the additional RMD from traditional accounts
                        const traditionalAccounts = accountBalances.filter(acc => acc.type === 'traditional');
                        const totalTraditionalBalance = traditionalAccounts.reduce((sum, acc) => sum + acc.balance, 0);

                        if (totalTraditionalBalance > 0) {
                            let rmdRemaining = additionalRMD;
                            traditionalAccounts.forEach(acc => {
                                const proportion = acc.balance / totalTraditionalBalance;
                                const amountFromAccount = Math.min(additionalRMD * proportion, acc.balance);
                                acc.balance -= amountFromAccount;
                                rmdRemaining -= amountFromAccount;
                            });

                            // Update tracking
                            traditionalWithdrawals += additionalRMD;
                            withdrawals += additionalRMD;
                            withdrawalsByType.traditional = (withdrawalsByType.traditional || 0) + additionalRMD;

                            // Log RMD enforcement
                            console.log(`Year ${year}: RMD enforced - Age ${personAAge}, required $${requiredRMD.toLocaleString()}, additional $${additionalRMD.toLocaleString()}`);
                        }
                    }
                }
            }

            const endBalance = this.getTotalBalance(accountBalances);

            // SECOND PASS: Recalculate taxes including Traditional IRA/401k withdrawals
            // traditionalWithdrawals was already calculated in the withdrawal section above
            // These withdrawals are taxed as ordinary income
            // ALSO include debt forgiveness tax bombs (e.g., student loan forgiveness)
            const totalTaxableIncome = annualIncome + milestoneTaxableIncome + debtTaxableIncome + traditionalWithdrawals;
            const finalTaxes = this.calculateTaxes(totalTaxableIncome, filingStatus);

            // Calculate additional tax burden from withdrawals
            const withdrawalTaxes = finalTaxes - annualTaxes;

            // Validation: end_balance should equal start_balance + contributions + windfalls - withdrawals + returns
            const calculatedEnd = startBalance + contributions + windfallContributions - withdrawals + totalInvestmentReturns;
            const balanceError = Math.abs(endBalance - calculatedEnd);
            if (balanceError > 0.01) {
                console.warn(`Balance reconciliation error in year ${year}: expected ${calculatedEnd}, got ${endBalance}, diff ${balanceError}`);
            }

            // Comprehensive year summary logging for large balance changes
            // Commented out to improve Monte Carlo performance
            // if (Math.abs(endBalance - startBalance) > 500000 || year === 2030 || year === 2031 || year === 2035 || year === 2036) {
            //     console.log(`\n=== YEAR ${year} SUMMARY ===`);
            //     console.log(`Start: $${startBalance.toLocaleString()}, End: $${endBalance.toLocaleString()}, Change: $${(endBalance - startBalance).toLocaleString()}`);
            //     console.log(`Income: $${annualIncome.toLocaleString()}, Expenses: $${annualExpenses.toLocaleString()}, Taxes: $${finalTaxes.toLocaleString()}`);
            //     console.log(`Contributions: $${contributions.toLocaleString()}, Windfalls: $${windfallContributions.toLocaleString()}`);
            //     console.log(`Withdrawals: $${withdrawals.toLocaleString()} (traditional: $${traditionalWithdrawals.toLocaleString()})`);
            //     console.log(`Returns: $${totalInvestmentReturns.toLocaleString()}`);
            // }

            // Calculate net worth including home equity and debts
            const homeEquity = homeValue - mortgageBalance;
            const totalDebtBalance = debtData.totalBalance;
            const netWorth = endBalance + homeEquity - totalDebtBalance;

            projections.push({
                year,
                startBalance,
                contributions,
                windfallContributions,
                withdrawals,
                traditionalWithdrawals, // Track how much came from Traditional accounts
                withdrawalsByType, // Track breakdown by account type (taxable, traditional, roth, hsa)
                withdrawalShortfall,
                investmentReturns: totalInvestmentReturns,
                endBalance,
                netWorth,
                income: annualIncome,
                taxes: finalTaxes, // Use final taxes including Traditional withdrawal taxation
                taxOnWithdrawals: withdrawalTaxes, // Track additional tax from withdrawals
                expenses: annualExpenses,
                netCashFlow,
                milestoneCosts,
                milestoneWindfalls,
                milestoneTaxableIncome, // Track tax bombs from milestones
                debtTaxableIncome, // Track tax bombs from debt forgiveness
                housingCosts,
                rentCost,
                mortgageCost,
                propertyTaxCost,
                insuranceCost,
                hoaCost,
                maintenanceCost,
                homeValue,
                mortgageBalance,
                homeEquity,
                debtPayments: debtData.totalPayment,
                debtInterest: debtData.totalInterest,
                debtBalance: debtData.totalBalance,
                accountBalances: JSON.parse(JSON.stringify(accountBalances)) // snapshot per year
            });
        }

        return projections;
    }

    executeWithdrawalSequence(accountBalances, targetWithdrawal, year, options = {}) {
        // CRITICAL FIX: Include 'cash' in withdrawal sequence
        // Cash should be withdrawn first (most liquid, no tax consequences)
        const sequence = options.forceTypes ||
            this.model.withdrawalStrategy.taxOptimizedSequence ||
            ['cash', 'taxable', 'traditional', 'roth', 'hsa'];

        let remaining = targetWithdrawal;
        let withdrawalDetails = {
            totalWithdrawn: 0,
            byType: {},
            byAccount: [],
            shortfall: 0
        };

        for (const accountType of sequence) {
            if (remaining <= 0.01) break; // floating point tolerance

            const accountsOfType = this.getAccountsByType(accountBalances, accountType);
            const totalAvailable = accountsOfType.reduce((sum, acc) => sum + acc.balance, 0);

            if (totalAvailable < 0.01) continue;

            const toWithdraw = Math.min(remaining, totalAvailable);

            // Withdraw proportionally from all accounts of this type
            accountsOfType.forEach(acc => {
                const proportion = acc.balance / totalAvailable;
                const amountFromAccount = toWithdraw * proportion;

                acc.balance -= amountFromAccount;
                withdrawalDetails.byAccount.push({
                    id: acc.id,
                    name: acc.name,
                    type: acc.type,
                    amount: amountFromAccount
                });
            });

            withdrawalDetails.byType[accountType] =
                (withdrawalDetails.byType[accountType] || 0) + toWithdraw;
            withdrawalDetails.totalWithdrawn += toWithdraw;
            remaining -= toWithdraw;
        }

        withdrawalDetails.shortfall = Math.max(0, remaining);
        return withdrawalDetails;
    }

    calculateWithdrawal(year, totalAssets, initialAssets, previousWithdrawal, yearsSinceRetirement) {
        const strategy = this.model.withdrawalStrategy;
        const inflation = this.model.settings.inflation / 100;

        // Only withdraw if we're at or past the withdrawal start year
        if (year < strategy.withdrawalStartYear) {
            return 0;
        }

        let withdrawal = 0;

        switch (strategy.type) {
            case 'tax_optimized':
                // Use the same logic as fixed_percentage, but withdrawal execution
                // will follow the tax-optimized sequence
                if (strategy.inflationAdjusted) {
                    const initialWithdrawal = initialAssets * (strategy.withdrawalPercentage / 100);
                    withdrawal = initialWithdrawal * Math.pow(1 + inflation, yearsSinceRetirement);
                } else {
                    withdrawal = totalAssets * (strategy.withdrawalPercentage / 100);
                }
                break;

            case 'fixed_percentage':
                if (strategy.inflationAdjusted) {
                    // Traditional 4% rule: Take X% of initial portfolio in year 1,
                    // then adjust that dollar amount for inflation each year
                    const initialWithdrawal = initialAssets * (strategy.withdrawalPercentage / 100);
                    withdrawal = initialWithdrawal * Math.pow(1 + inflation, yearsSinceRetirement);
                } else {
                    // Variable percentage: Take X% of CURRENT portfolio each year
                    // (more conservative, adjusts spending to portfolio performance)
                    withdrawal = totalAssets * (strategy.withdrawalPercentage / 100);
                }
                break;

            case 'fixed_amount':
                // Fixed dollar amount, adjusted for inflation if enabled
                withdrawal = strategy.fixedAmount;
                if (strategy.inflationAdjusted && yearsSinceRetirement > 0) {
                    withdrawal = strategy.fixedAmount * Math.pow(1 + inflation, yearsSinceRetirement);
                }
                break;

            case 'dynamic':
                // Guyton-Klinger dynamic strategy
                if (yearsSinceRetirement === 0) {
                    // First year: use initial rate
                    withdrawal = totalAssets * (strategy.dynamicInitialRate / 100);
                } else {
                    // Subsequent years: adjust based on guardrails
                    const inflationAdjustedPrevious = previousWithdrawal * (1 + inflation);
                    const upperThreshold = initialAssets * (1 + strategy.dynamicUpperGuardrail / 100);
                    const lowerThreshold = initialAssets * (1 - strategy.dynamicLowerGuardrail / 100);

                    if (totalAssets > upperThreshold) {
                        // Portfolio grew significantly, increase spending
                        withdrawal = inflationAdjustedPrevious * 1.10; // 10% increase
                    } else if (totalAssets < lowerThreshold) {
                        // Portfolio declined significantly, decrease spending
                        withdrawal = inflationAdjustedPrevious * 0.90; // 10% decrease
                    } else {
                        // Within guardrails, adjust for inflation
                        withdrawal = inflationAdjustedPrevious;
                    }
                }
                break;

            case 'rmd':
                // Required Minimum Distributions using IRS Uniform Lifetime Table
                // Calculate age based on Person A's birth year
                const personAAge = year - this.model.settings.household.personA.birthYear;
                if (personAAge >= strategy.rmdStartAge) {
                    const rmdDivisor = this.getRMDDivisor(personAAge);
                    withdrawal = totalAssets / rmdDivisor;
                }
                break;
        }

        // Don't withdraw more than available assets
        return Math.min(withdrawal, totalAssets);
    }

    getRMDDivisor(age) {
        // IRS Uniform Lifetime Table (simplified)
        const table = {
            73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
            79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
            85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2,
            91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
            97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
        };
        return table[age] || (age > 100 ? 6.4 : 26.5);
    }

    calculateTaxes(income, filingStatus) {
        // 2024 Federal Tax Brackets and Standard Deduction
        // Note: These are fixed at 2024 levels and do not adjust for inflation
        const standardDeduction = {
            single: 14600,
            married: 29200
        };

        const brackets = {
            single: [
                { limit: 11600, rate: 0.10 },
                { limit: 47150, rate: 0.12 },
                { limit: 100525, rate: 0.22 },
                { limit: 191950, rate: 0.24 },
                { limit: 243725, rate: 0.32 },
                { limit: 609350, rate: 0.35 },
                { limit: Infinity, rate: 0.37 }
            ],
            married: [
                { limit: 23200, rate: 0.10 },
                { limit: 94300, rate: 0.12 },
                { limit: 201050, rate: 0.22 },
                { limit: 383900, rate: 0.24 },
                { limit: 487450, rate: 0.32 },
                { limit: 731200, rate: 0.35 },
                { limit: Infinity, rate: 0.37 }
            ]
        };

        // Apply standard deduction
        const deduction = standardDeduction[filingStatus] || standardDeduction.single;
        const taxableIncome = Math.max(0, income - deduction);

        // If income is below standard deduction, no federal tax
        if (taxableIncome <= 0) {
            return 0;
        }

        const applicableBrackets = brackets[filingStatus] || brackets.single;
        let tax = 0;
        let remainingIncome = taxableIncome;
        let previousLimit = 0;

        for (const bracket of applicableBrackets) {
            const taxableInBracket = Math.min(remainingIncome, bracket.limit - previousLimit);
            if (taxableInBracket <= 0) break;

            tax += taxableInBracket * bracket.rate;
            remainingIncome -= taxableInBracket;
            previousLimit = bracket.limit;

            if (remainingIncome <= 0) break;
        }

        return tax;
    }

    getStandardDeduction(filingStatus) {
        // 2024 Federal Standard Deductions
        const standardDeduction = {
            single: 14600,
            married: 29200
        };
        return standardDeduction[filingStatus] || standardDeduction.single;
    }

    getMarginalTaxBracket(income, filingStatus) {
        // Returns the marginal tax rate (highest bracket that applies)
        const standardDeduction = this.getStandardDeduction(filingStatus);
        const taxableIncome = Math.max(0, income - standardDeduction);

        if (taxableIncome <= 0) {
            return 0;
        }

        const brackets = {
            single: [
                { limit: 11600, rate: 10 },
                { limit: 47150, rate: 12 },
                { limit: 100525, rate: 22 },
                { limit: 191950, rate: 24 },
                { limit: 243725, rate: 32 },
                { limit: 609350, rate: 35 },
                { limit: Infinity, rate: 37 }
            ],
            married: [
                { limit: 23200, rate: 10 },
                { limit: 94300, rate: 12 },
                { limit: 201050, rate: 22 },
                { limit: 383900, rate: 24 },
                { limit: 487450, rate: 32 },
                { limit: 731200, rate: 35 },
                { limit: Infinity, rate: 37 }
            ]
        };

        const applicableBrackets = brackets[filingStatus] || brackets.single;

        // Find the highest bracket that the income reaches
        for (const bracket of applicableBrackets) {
            if (taxableIncome <= bracket.limit) {
                return bracket.rate;
            }
        }

        return 37; // Top bracket
    }

    calculateCreditCardPaymentForYear(card, year) {
        // Calculate minimum payment + extra payment
        // Returns: { payment, interestPaid, principalPaid, endingBalance }
        const monthlyInterestRate = card.apr / 100 / 12;
        let balance = card.balance;
        let annualInterest = 0;
        let annualPrincipal = 0;

        for (let month = 0; month < 12; month++) {
            const minimumPayment = balance * (card.minimumPaymentPercent / 100);
            const totalPayment = Math.max(minimumPayment, 25) + card.extraPayment; // $25 min
            const interestCharge = balance * monthlyInterestRate;
            const principalPayment = Math.min(totalPayment - interestCharge, balance);

            annualInterest += interestCharge;
            annualPrincipal += principalPayment;
            balance = Math.max(0, balance - principalPayment);

            if (balance === 0) break;
        }

        return {
            payment: annualInterest + annualPrincipal,
            interestPaid: annualInterest,
            principalPaid: annualPrincipal,
            endingBalance: balance
        };
    }

    calculateLoanPaymentForYear(loan, year) {
        // Calculate annual loan payment and remaining balance
        // Returns: { payment, interestPaid, principalPaid, endingBalance, paidOff, forgiven, taxableAmount }
        const monthlyRate = loan.interestRate / 100 / 12;
        const monthsElapsed = (year - loan.startYear) * 12;
        const totalMonths = loan.termYears * 12;

        // Check if loan is forgiven this year
        if (loan.forgiveYear && year === loan.forgiveYear) {
            // Calculate balance at forgiveness
            let balance = loan.balance;
            for (let m = 0; m < monthsElapsed; m++) {
                const interest = balance * monthlyRate;
                const principal = loan.monthlyPayment - interest;
                balance -= principal;
                if (balance <= 0) break;
            }

            const forgivenAmount = loan.forgivenessAmount || Math.max(0, balance);
            const taxableAmount = loan.forgivenessIsTaxable ? forgivenAmount : 0;

            return {
                payment: loan.monthlyPayment * 12, // Final year of payments
                interestPaid: 0,
                principalPaid: 0,
                endingBalance: 0,
                paidOff: false,
                forgiven: true,
                taxableAmount
            };
        }

        // Check if loan is paid off this year (lump sum)
        if (loan.payoffYear && year === loan.payoffYear) {
            // Calculate balance at payoff
            let balance = loan.balance;
            for (let m = 0; m < monthsElapsed; m++) {
                const interest = balance * monthlyRate;
                const principal = loan.monthlyPayment - interest;
                balance -= principal;
                if (balance <= 0) break;
            }

            return {
                payment: balance, // Lump sum payoff
                interestPaid: 0,
                principalPaid: balance,
                endingBalance: 0,
                paidOff: true,
                forgiven: false,
                taxableAmount: 0
            };
        }

        // Already paid off or forgiven in previous year
        if (loan.payoffYear && year > loan.payoffYear) {
            return { payment: 0, interestPaid: 0, principalPaid: 0, endingBalance: 0, paidOff: false, forgiven: false, taxableAmount: 0 };
        }
        if (loan.forgiveYear && year > loan.forgiveYear) {
            return { payment: 0, interestPaid: 0, principalPaid: 0, endingBalance: 0, paidOff: false, forgiven: false, taxableAmount: 0 };
        }

        // Already paid off by normal amortization
        if (monthsElapsed >= totalMonths) {
            return { payment: 0, interestPaid: 0, principalPaid: 0, endingBalance: 0, paidOff: false, forgiven: false, taxableAmount: 0 };
        }

        // Calculate current balance (amortization)
        let balance = loan.balance;
        for (let m = 0; m < monthsElapsed; m++) {
            const interest = balance * monthlyRate;
            const principal = loan.monthlyPayment - interest;
            balance -= principal;

            // Protection against negative amortization (infinite loop)
            if (balance > loan.balance * 2) {
                console.warn(`Loan "${loan.name}" has negative amortization (payment < interest). Balance growing indefinitely.`);
                balance = loan.balance; // Reset to original balance
                break;
            }
        }

        // Calculate this year's payments
        let annualInterest = 0;
        let annualPrincipal = 0;
        for (let m = 0; m < 12 && balance > 0; m++) {
            const interest = balance * monthlyRate;
            const principal = Math.min(loan.monthlyPayment - interest, balance);
            annualInterest += interest;
            annualPrincipal += principal;
            balance -= principal;
        }

        return {
            payment: loan.monthlyPayment * Math.min(12, totalMonths - monthsElapsed),
            interestPaid: annualInterest,
            principalPaid: annualPrincipal,
            endingBalance: Math.max(0, balance),
            paidOff: false,
            forgiven: false,
            taxableAmount: 0
        };
    }

    calculateHomeValueForYear(property, year) {
        // Calculate appreciated home value
        const yearsSincePurchase = year - property.purchaseYear;
        if (yearsSincePurchase < 0) return 0;

        const appreciationRate = property.appreciationRate / 100;
        return property.purchasePrice * Math.pow(1 + appreciationRate, yearsSincePurchase);
    }

    calculateMortgageBalanceForYear(property, year) {
        // Calculate remaining mortgage balance
        if (year < property.purchaseYear) {
            return { balance: 0, monthlyPayment: 0 };
        }

        const loanAmount = property.loanAmount;
        if (loanAmount === 0 || property.interestRate === 0) {
            return { balance: 0, monthlyPayment: 0 };
        }

        const monthlyRate = property.interestRate / 100 / 12;
        const totalMonths = property.loanTermYears * 12;
        const monthsElapsed = (year - property.purchaseYear) * 12;

        if (monthsElapsed >= totalMonths) {
            return { balance: 0, monthlyPayment: property.monthlyPayment };
        }

        // Calculate remaining balance after monthsElapsed
        let balance = loanAmount;
        for (let m = 0; m < monthsElapsed; m++) {
            const interest = balance * monthlyRate;
            const principal = property.monthlyPayment - interest;
            balance -= principal;
            if (balance <= 0) break;
        }

        return {
            balance: Math.max(0, balance),
            monthlyPayment: property.monthlyPayment
        };
    }

    calculateDebtCostsForYear(year) {
        let totalPayment = 0;
        let totalInterest = 0;
        let totalBalance = 0;
        let totalTaxableIncome = 0; // Track taxable forgiveness

        // Credit cards
        this.model.debts.creditCards.forEach(card => {
            const result = this.calculateCreditCardPaymentForYear(card, year);
            totalPayment += result.payment;
            totalInterest += result.interestPaid;
            totalBalance += result.endingBalance;
        });

        // Loans
        this.model.debts.loans.forEach(loan => {
            if (year >= loan.startYear) {
                const result = this.calculateLoanPaymentForYear(loan, year);
                totalPayment += result.payment;
                totalInterest += result.interestPaid;
                totalBalance += result.endingBalance;
                totalTaxableIncome += result.taxableAmount || 0; // Add taxable forgiveness
            }
        });

        return {
            totalPayment,
            totalInterest,
            totalBalance,
            totalTaxableIncome // Return taxable forgiveness for tax calculations
        };
    }
}

// Monte Carlo Simulation
class MonteCarloSimulator {
    constructor(model, projectionEngine) {
        this.model = model;
        this.engine = projectionEngine;
    }

    getReturnForYear(year, defaultReturn, defaultVolatility) {
        // Find the applicable glide path segment for this year
        const glidePath = this.model.investmentGlidePath;
        let applicableSegment = glidePath[0];

        for (let i = glidePath.length - 1; i >= 0; i--) {
            if (year >= glidePath[i].startYear) {
                applicableSegment = glidePath[i];
                break;
            }
        }

        return {
            expectedReturn: applicableSegment?.expectedReturn ?? defaultReturn,
            volatility: applicableSegment?.volatility ?? defaultVolatility
        };
    }

    runSimulation(numSimulations, expectedReturn, volatility, years = 40) {
        const results = [];

        // Save original glide path - deep clone to avoid mutation
        const originalGlidePath = JSON.parse(JSON.stringify(this.model.investmentGlidePath));

        for (let sim = 0; sim < numSimulations; sim++) {
            // Generate random returns for each year matching the glide path structure
            const currentYear = this.model.settings.planStartYear;
            const randomGlidePath = [];

            for (let i = 0; i <= years; i++) {
                const year = currentYear + i;

                // Get the base expected return and volatility for this year
                const { expectedReturn: yearReturn, volatility: yearVolatility} = this.getReturnForYear(year, expectedReturn, volatility);

                // Generate random return using Box-Muller transform for normal distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                const randomReturn = yearReturn + (normalRandom * yearVolatility);

                randomGlidePath.push({
                    startYear: year,
                    expectedReturn: randomReturn,
                    volatility: yearVolatility
                });
            }

            // Temporarily replace the glide path with our random one
            this.model.investmentGlidePath = randomGlidePath;

            // Run the ACTUAL projection engine with random returns
            // CRITICAL: Create projection with current state
            const projection = this.engine.projectNetWorth(years);

            // IMMEDIATELY restore original glide path before next iteration
            this.model.investmentGlidePath = JSON.parse(JSON.stringify(originalGlidePath));

            // Extract results and validate
            const simResults = projection.map(p => ({
                year: p.year,
                netWorth: isNaN(p.netWorth) || !isFinite(p.netWorth) ? 0 : p.netWorth,
                homeEquity: isNaN(p.homeEquity) || !isFinite(p.homeEquity) ? 0 : p.homeEquity,
                netWorthExcludingHome: isNaN(p.netWorth) || !isFinite(p.netWorth) ? 0 :
                    (p.netWorth - (p.homeEquity || 0))
            }));

            // Debug logging for first simulation
            if (sim === 0) {
                console.log(`Simulation ${sim} final netWorth:`, simResults[simResults.length - 1].netWorth);
            }

            results.push(simResults);
        }

        // Final restore of original glide path (redundant but safe)
        this.model.investmentGlidePath = originalGlidePath;

        return this.analyzeResults(results);
    }

    // OLD MONTE CARLO CODE - KEEPING FOR REFERENCE BUT NOT USED
    runSimulation_OLD(numSimulations, expectedReturn, volatility, years = 40) {
        const results = [];

        for (let sim = 0; sim < numSimulations; sim++) {
            const currentYear = this.model.settings.planStartYear;
            let totalAssets = this.model.accounts.reduce((sum, acc) => sum + acc.balance, 0);
            const initialAssetsAtWithdrawal = totalAssets;
            let previousWithdrawal = 0;
            let yearsSinceWithdrawalStart = 0;
            const simResults = [];

            for (let i = 0; i <= years; i++) {
                const year = currentYear + i;

                // Calculate income and expenses (OLD SIMPLIFIED VERSION)
                let annualIncome = 0;
                this.model.incomes.forEach(income => {
                    if (year >= income.startYear && (!income.endYear || year <= income.endYear)) {
                        const yearsSinceStart = year - income.startYear;
                        const adjustedAmount = income.amount * Math.pow(1 + income.growth / 100, yearsSinceStart);
                        annualIncome += income.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                    }
                });

                // Add retirement income - Social Security for Person A (with COLA)
                const personA = this.model.settings.household.personA;
                if (personA.socialSecurity && personA.socialSecurity.enabled) {
                    const personAAge = year - personA.birthYear;
                    if (personAAge >= personA.socialSecurity.startAge) {
                        const startYear = personA.birthYear + personA.socialSecurity.startAge;
                        const yearsSinceSSStart = Math.max(0, year - startYear);
                        const inflationRate = this.model.settings.inflation / 100;
                        const adjustedSS = personA.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                        annualIncome += adjustedSS;
                    }
                }

                // Add retirement income - Social Security for Person B (with COLA)
                const personB = this.model.settings.household.personB;
                if (personB && personB.socialSecurity && personB.socialSecurity.enabled) {
                    const personBAge = year - personB.birthYear;
                    if (personBAge >= personB.socialSecurity.startAge) {
                        const startYear = personB.birthYear + personB.socialSecurity.startAge;
                        const yearsSinceSSStart = Math.max(0, year - startYear);
                        const inflationRate = this.model.settings.inflation / 100;
                        const adjustedSS = personB.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                        annualIncome += adjustedSS;
                    }
                }

                // Add retirement income - Pension
                const pension = this.model.settings.pension;
                if (pension && pension.enabled && year >= pension.startYear) {
                    const yearsSinceStart = year - pension.startYear;
                    const adjustedPension = pension.annualAmount * Math.pow(1 + pension.growth / 100, yearsSinceStart);
                    annualIncome += adjustedPension;
                }

                let annualExpenses = 0;
                this.model.expenses.forEach(expense => {
                    if (year >= expense.startYear && (!expense.endYear || year <= expense.endYear)) {
                        const yearsSinceStart = year - expense.startYear;
                        const adjustedAmount = expense.amount * Math.pow(1 + expense.growth / 100, yearsSinceStart);
                        annualExpenses += expense.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                    }
                });

                // Check for milestone costs and windfalls
                let milestoneCosts = 0;
                let milestoneWindfalls = 0;
                this.model.milestones.forEach(milestone => {
                    if (milestone.year === year) {
                        if (milestone.isPositive) {
                            milestoneWindfalls += milestone.cost;
                        } else {
                            milestoneCosts += milestone.cost;
                        }
                    }
                    if (milestone.recurring && year >= milestone.year) {
                        if (milestone.isPositive) {
                            milestoneWindfalls += milestone.recurringAmount;
                        } else {
                            milestoneCosts += milestone.recurringAmount;
                        }
                    }
                });

                // Calculate taxes on income
                const filingStatus = this.model.settings.filingStatus;
                const annualTaxes = this.engine.calculateTaxes(annualIncome, filingStatus);

                // Calculate withdrawal if applicable
                let withdrawal = 0;
                if (year >= this.model.withdrawalStrategy.withdrawalStartYear) {
                    if (year === this.model.withdrawalStrategy.withdrawalStartYear) {
                        yearsSinceWithdrawalStart = 0;
                    } else {
                        yearsSinceWithdrawalStart++;
                    }
                    withdrawal = this.engine.calculateWithdrawal(year, totalAssets, initialAssetsAtWithdrawal, previousWithdrawal, yearsSinceWithdrawalStart);
                    previousWithdrawal = withdrawal;
                }

                const annualSavings = annualIncome - annualTaxes - annualExpenses - milestoneCosts + milestoneWindfalls - withdrawal;

                // Get the appropriate return and volatility for this year
                const { expectedReturn: yearReturn, volatility: yearVolatility } = this.getReturnForYear(year, expectedReturn, volatility);

                // Random return using Box-Muller transform for normal distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                const returnRate = (yearReturn / 100) + (normalRandom * yearVolatility / 100);

                totalAssets = totalAssets * (1 + returnRate) + annualSavings;

                simResults.push({
                    year,
                    netWorth: totalAssets
                });
            }

            results.push(simResults);
        }

        return this.analyzeResults(results);
    }

    analyzeResults(simulations) {
        // FIX: Handle empty simulations array
        if (!simulations || simulations.length === 0) {
            console.warn('No simulations to analyze');
            return [];
        }

        const numYears = simulations[0].length;
        const analysis = [];

        for (let yearIdx = 0; yearIdx < numYears; yearIdx++) {
            const netWorths = simulations.map(sim => sim[yearIdx].netWorth).sort((a, b) => a - b);
            const netWorthsExcludingHome = simulations.map(sim => sim[yearIdx].netWorthExcludingHome).sort((a, b) => a - b);
            const year = simulations[0][yearIdx].year;

            analysis.push({
                year,
                min: netWorths[0],
                p10: netWorths[Math.floor(netWorths.length * 0.1)],
                p25: netWorths[Math.floor(netWorths.length * 0.25)],
                median: netWorths[Math.floor(netWorths.length * 0.5)],
                p75: netWorths[Math.floor(netWorths.length * 0.75)],
                max: netWorths[netWorths.length - 1],
                successRate: (netWorths.filter(nw => nw > 0).length / netWorths.length) * 100,
                // Net worth excluding primary home (liquid net worth)
                minExcludingHome: netWorthsExcludingHome[0],
                p10ExcludingHome: netWorthsExcludingHome[Math.floor(netWorthsExcludingHome.length * 0.1)],
                p25ExcludingHome: netWorthsExcludingHome[Math.floor(netWorthsExcludingHome.length * 0.25)],
                medianExcludingHome: netWorthsExcludingHome[Math.floor(netWorthsExcludingHome.length * 0.5)],
                p75ExcludingHome: netWorthsExcludingHome[Math.floor(netWorthsExcludingHome.length * 0.75)],
                maxExcludingHome: netWorthsExcludingHome[netWorthsExcludingHome.length - 1],
                successRateExcludingHome: (netWorthsExcludingHome.filter(nw => nw > 0).length / netWorthsExcludingHome.length) * 100
            });
        }

        return analysis;
    }
}

// UI Controller
class UIController {
    constructor() {
        this.model = new FinancialModel();
        this.basePlan = null; // Stores the base plan when viewing a scenario
        this.scenarios = []; // Stored scenarios list (separate from working data)
        this.projectionEngine = new ProjectionEngine(this.model);
        this.simulator = new MonteCarloSimulator(this.model, this.projectionEngine);
        this.charts = {};
        this.currentScenarioId = null; // Track which scenario is currently loaded (null = base plan)

        this.initializeEventListeners();
        this.initializeCharts();
        this.loadData();
        this.updateScenariosList(); // Update scenarios list to show current scenario
        this.updateDashboard();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Tab group dropdowns
        document.querySelectorAll('.tab-group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const group = btn.parentElement;
                // Close all other groups
                document.querySelectorAll('.tab-group').forEach(g => {
                    if (g !== group) g.classList.remove('open');
                });
                // Toggle this group
                group.classList.toggle('open');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-group')) {
                document.querySelectorAll('.tab-group').forEach(g => g.classList.remove('open'));
            }
        });

        // Account management
        document.getElementById('addAccountBtn').addEventListener('click', () => this.showAccountModal());

        // Income management
        document.getElementById('addIncomeBtn').addEventListener('click', () => this.showIncomeModal());

        // Expense management
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.showExpenseModal());

        // Milestone management
        document.getElementById('addMilestoneBtn').addEventListener('click', () => this.showMilestoneModal());

        // Housing management
        const addRentalPeriodBtn = document.getElementById('addRentalPeriodBtn');
        if (addRentalPeriodBtn) {
            addRentalPeriodBtn.addEventListener('click', () => this.showRentalPeriodModal());
        }

        const addPropertyBtn = document.getElementById('addPropertyBtn');
        if (addPropertyBtn) {
            addPropertyBtn.addEventListener('click', () => this.showPropertyModal());
        }

        // Debt management
        const addCreditCardBtn = document.getElementById('addCreditCardBtn');
        if (addCreditCardBtn) {
            addCreditCardBtn.addEventListener('click', () => this.showCreditCardModal());
        }

        const addLoanBtn = document.getElementById('addLoanBtn');
        if (addLoanBtn) {
            addLoanBtn.addEventListener('click', () => this.showLoanModal());
        }

        // Glide path management
        document.getElementById('addGlidePathBtn').addEventListener('click', () => this.showGlidePathModal());

        // Simulation
        document.getElementById('runSimulationBtn').addEventListener('click', () => this.runMonteCarlo());

        // Stress test buttons
        document.getElementById('stressTest2008').addEventListener('click', () => this.runStressTest('2008'));
        document.getElementById('stressTest2000').addEventListener('click', () => this.runStressTest('2000'));
        document.getElementById('stressTest2020').addEventListener('click', () => this.runStressTest('2020'));
        document.getElementById('stressTestStagflation').addEventListener('click', () => this.runStressTest('stagflation'));

        // Stress test timing controls
        const stressTestYearInput = document.getElementById('stressTestYear');
        document.querySelectorAll('input[name="stressTestTiming"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                stressTestYearInput.disabled = e.target.value !== 'custom';
                if (e.target.value === 'custom' && !stressTestYearInput.value) {
                    stressTestYearInput.value = '10'; // Default to 10 years out
                }
            });
        });

        // Data management
        document.getElementById('aiExportBtn').addEventListener('click', () => this.exportForAIReview());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveData());
        document.getElementById('loadBtn').addEventListener('click', () => this.loadDataFromFile());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('deleteAllBtn').addEventListener('click', () => this.deleteAllData());

        // Tax projections
        document.getElementById('updateTaxProjectionsBtn').addEventListener('click', () => this.updateTaxProjections());

        // Future Sankey diagram
        document.getElementById('updateFutureSankeyBtn').addEventListener('click', () => this.updateFutureSankey());

        // Withdrawal strategy
        document.getElementById('withdrawalStrategy').addEventListener('change', (e) => this.toggleWithdrawalSettings(e.target.value));
        document.getElementById('saveWithdrawalStrategyBtn').addEventListener('click', () => this.saveWithdrawalStrategy());

        // Scenario management
        document.getElementById('saveScenarioBtn').addEventListener('click', () => this.saveScenario());
        document.getElementById('clearScenariosBtn').addEventListener('click', () => this.clearScenarios());

        // Settings
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('enablePersonB').addEventListener('change', (e) => this.togglePersonB(e.target.checked));

        // Auto-calculate ages when birth year or retirement year changes
        ['planStartYear', 'personABirthYear', 'personARetirementYear', 'personALifeExpectancy'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updatePersonACalculations());
        });
        ['personBBirthYear', 'personBRetirementYear', 'personBLifeExpectancy'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updatePersonBCalculations());
        });

        // Retirement income toggles
        document.getElementById('personASocialSecurityEnabled').addEventListener('change', (e) => {
            document.getElementById('personASocialSecurityAmount').disabled = !e.target.checked;
            document.getElementById('personASocialSecurityStartAge').disabled = !e.target.checked;
        });
        document.getElementById('personBSocialSecurityEnabled').addEventListener('change', (e) => {
            document.getElementById('personBSocialSecurityAmount').disabled = !e.target.checked;
            document.getElementById('personBSocialSecurityStartAge').disabled = !e.target.checked;
        });
        document.getElementById('pensionEnabled').addEventListener('change', (e) => {
            const disabled = !e.target.checked;
            document.getElementById('pensionOwner').disabled = disabled;
            document.getElementById('pensionName').disabled = disabled;
            document.getElementById('pensionAmount').disabled = disabled;
            document.getElementById('pensionStartYear').disabled = disabled;
            document.getElementById('pensionGrowth').disabled = disabled;
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.tab-group').forEach(group => group.classList.remove('active', 'open'));

        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        tabBtn.classList.add('active');
        document.getElementById(tabName).classList.add('active');

        // If the tab is inside a dropdown, highlight the parent group
        const parentGroup = tabBtn.closest('.tab-group');
        if (parentGroup) {
            parentGroup.classList.add('active');
        }

        if (tabName === 'dashboard') {
            this.updateDashboard();
        } else if (tabName === 'settings') {
            this.loadSettings();
        } else if (tabName === 'simulation') {
            this.updateGlidePathList();
        } else if (tabName === 'withdrawal') {
            this.loadWithdrawalSettings();
        } else if (tabName === 'scenarios') {
            this.updateScenariosList();
        } else if (tabName === 'housing') {
            // Load rental periods and properties lists
            this.updateRentalPeriodsList();
            this.updatePropertiesList();
        } else if (tabName === 'debts') {
            this.updateCreditCardsList();
            this.updateLoansList();
        } else if (tabName === 'taxes') {
            this.updateTaxProjections();
        }
    }

    loadSettings() {
        const settings = this.model.settings;

        document.getElementById('planStartYear').value = settings.planStartYear;
        document.getElementById('projectionHorizon').value = settings.projectionHorizon;
        document.getElementById('inflationRate').value = settings.inflation;
        document.getElementById('householdFilingStatus').value = settings.filingStatus;

        // Person A
        document.getElementById('personAName').value = settings.household.personA.name;
        document.getElementById('personABirthYear').value = settings.household.personA.birthYear;
        document.getElementById('personARetirementYear').value = settings.household.personA.retirementYear;
        document.getElementById('personALifeExpectancy').value = settings.household.personA.lifeExpectancy;
        this.updatePersonACalculations();

        // Person B
        const hasPersonB = settings.household.personB !== null;
        document.getElementById('enablePersonB').checked = hasPersonB;
        document.getElementById('personBFields').style.display = hasPersonB ? 'block' : 'none';

        if (hasPersonB) {
            document.getElementById('personBName').value = settings.household.personB.name;
            document.getElementById('personBBirthYear').value = settings.household.personB.birthYear;
            document.getElementById('personBRetirementYear').value = settings.household.personB.retirementYear;
            document.getElementById('personBLifeExpectancy').value = settings.household.personB.lifeExpectancy;
            this.updatePersonBCalculations();
        }

        // Retirement Income - Person A Social Security
        const personASS = settings.household.personA.socialSecurity || { enabled: false, annualAmount: 0, startAge: 67 };
        document.getElementById('personASocialSecurityEnabled').checked = personASS.enabled;
        document.getElementById('personASocialSecurityAmount').value = personASS.annualAmount;
        document.getElementById('personASocialSecurityAmount').disabled = !personASS.enabled;
        document.getElementById('personASocialSecurityStartAge').value = personASS.startAge;
        document.getElementById('personASocialSecurityStartAge').disabled = !personASS.enabled;

        // Retirement Income - Person B Social Security
        document.getElementById('personBRetirementIncome').style.display = hasPersonB ? 'block' : 'none';
        if (hasPersonB) {
            const personBSS = settings.household.personB.socialSecurity || { enabled: false, annualAmount: 0, startAge: 67 };
            document.getElementById('personBSocialSecurityEnabled').checked = personBSS.enabled;
            document.getElementById('personBSocialSecurityAmount').value = personBSS.annualAmount;
            document.getElementById('personBSocialSecurityAmount').disabled = !personBSS.enabled;
            document.getElementById('personBSocialSecurityStartAge').value = personBSS.startAge;
            document.getElementById('personBSocialSecurityStartAge').disabled = !personBSS.enabled;
        }

        // Retirement Income - Pension
        const pension = settings.pension || { enabled: false, owner: 'personA', name: '', annualAmount: 0, startYear: settings.planStartYear, growth: 0 };
        document.getElementById('pensionEnabled').checked = pension.enabled;
        document.getElementById('pensionOwner').value = pension.owner;
        document.getElementById('pensionOwner').disabled = !pension.enabled;
        document.getElementById('pensionName').value = pension.name;
        document.getElementById('pensionName').disabled = !pension.enabled;
        document.getElementById('pensionAmount').value = pension.annualAmount;
        document.getElementById('pensionAmount').disabled = !pension.enabled;
        document.getElementById('pensionStartYear').value = pension.startYear;
        document.getElementById('pensionStartYear').disabled = !pension.enabled;
        document.getElementById('pensionGrowth').value = pension.growth;
        document.getElementById('pensionGrowth').disabled = !pension.enabled;

        // Run validation and display
        this.displayValidation();
    }

    togglePersonB(enabled) {
        document.getElementById('personBFields').style.display = enabled ? 'block' : 'none';
        document.getElementById('personBRetirementIncome').style.display = enabled ? 'block' : 'none';
        if (enabled && !this.model.settings.household.personB) {
            // Initialize Person B with defaults
            const currentYear = this.model.settings.planStartYear;
            this.model.settings.household.personB = {
                name: 'Person B',
                birthYear: currentYear - 30,
                retirementYear: currentYear + 35,
                lifeExpectancy: 95,
                socialSecurity: {
                    enabled: false,
                    annualAmount: 0,
                    startAge: 67
                }
            };
            document.getElementById('personBName').value = 'Person B';
            document.getElementById('personBBirthYear').value = currentYear - 30;
            document.getElementById('personBRetirementYear').value = currentYear + 35;
            document.getElementById('personBLifeExpectancy').value = 95;
            this.updatePersonBCalculations();
        }
    }

    updatePersonACalculations() {
        const startYear = parseInt(document.getElementById('planStartYear').value);
        const birthYear = parseInt(document.getElementById('personABirthYear').value);
        const retirementYear = parseInt(document.getElementById('personARetirementYear').value);

        if (startYear && birthYear && retirementYear) {
            const currentAge = startYear - birthYear;
            const retirementAge = retirementYear - birthYear;
            const yearsToRetirement = retirementYear - startYear;

            document.getElementById('personACurrentAge').textContent = currentAge;
            document.getElementById('personARetirementAge').textContent = retirementAge;
            document.getElementById('personAYearsToRetirement').textContent = Math.max(0, yearsToRetirement);
        }
    }

    updatePersonBCalculations() {
        const startYear = parseInt(document.getElementById('planStartYear').value);
        const birthYear = parseInt(document.getElementById('personBBirthYear').value);
        const retirementYear = parseInt(document.getElementById('personBRetirementYear').value);

        if (startYear && birthYear && retirementYear) {
            const currentAge = startYear - birthYear;
            const retirementAge = retirementYear - birthYear;
            const yearsToRetirement = retirementYear - startYear;

            document.getElementById('personBCurrentAge').textContent = currentAge;
            document.getElementById('personBRetirementAge').textContent = retirementAge;
            document.getElementById('personBYearsToRetirement').textContent = Math.max(0, yearsToRetirement);
        }
    }

    saveSettings() {
        // Update model
        this.model.settings.planStartYear = parseInt(document.getElementById('planStartYear').value);
        this.model.settings.projectionHorizon = parseInt(document.getElementById('projectionHorizon').value);
        this.model.settings.inflation = parseFloat(document.getElementById('inflationRate').value);
        this.model.settings.filingStatus = document.getElementById('householdFilingStatus').value;

        // Person A
        this.model.settings.household.personA.name = document.getElementById('personAName').value;
        this.model.settings.household.personA.birthYear = parseInt(document.getElementById('personABirthYear').value);
        this.model.settings.household.personA.retirementYear = parseInt(document.getElementById('personARetirementYear').value);
        this.model.settings.household.personA.lifeExpectancy = parseInt(document.getElementById('personALifeExpectancy').value);

        // Person B
        if (document.getElementById('enablePersonB').checked) {
            this.model.settings.household.personB = {
                name: document.getElementById('personBName').value,
                birthYear: parseInt(document.getElementById('personBBirthYear').value),
                retirementYear: parseInt(document.getElementById('personBRetirementYear').value),
                lifeExpectancy: parseInt(document.getElementById('personBLifeExpectancy').value),
                socialSecurity: {
                    enabled: document.getElementById('personBSocialSecurityEnabled').checked,
                    annualAmount: parseFloat(document.getElementById('personBSocialSecurityAmount').value) || 0,
                    startAge: parseInt(document.getElementById('personBSocialSecurityStartAge').value) || 67
                }
            };
        } else {
            this.model.settings.household.personB = null;
        }

        // Retirement Income - Person A Social Security
        this.model.settings.household.personA.socialSecurity = {
            enabled: document.getElementById('personASocialSecurityEnabled').checked,
            annualAmount: parseFloat(document.getElementById('personASocialSecurityAmount').value) || 0,
            startAge: parseInt(document.getElementById('personASocialSecurityStartAge').value) || 67
        };

        // Retirement Income - Pension
        this.model.settings.pension = {
            enabled: document.getElementById('pensionEnabled').checked,
            owner: document.getElementById('pensionOwner').value,
            name: document.getElementById('pensionName').value,
            annualAmount: parseFloat(document.getElementById('pensionAmount').value) || 0,
            startYear: parseInt(document.getElementById('pensionStartYear').value) || this.model.settings.planStartYear,
            growth: parseFloat(document.getElementById('pensionGrowth').value) || 0
        };

        // Validate
        const validation = this.model.validate();

        if (validation.valid) {
            this.saveData();
            alert('Settings saved successfully!');
            this.updateDashboard();
        } else {
            alert('Please fix validation errors before saving:\n\n' +
                  validation.errors.map(e => '• ' + e.message).join('\n'));
        }

        this.displayValidation();
    }

    displayValidation() {
        const validation = this.model.validate();
        const displayDiv = document.getElementById('validationDisplay');
        const errorsDiv = document.getElementById('validationErrors');
        const warningsDiv = document.getElementById('validationWarnings');

        if (validation.errors.length === 0 && validation.warnings.length === 0) {
            displayDiv.style.display = 'none';
            return;
        }

        displayDiv.style.display = 'block';

        // Display errors
        if (validation.errors.length > 0) {
            errorsDiv.innerHTML = `
                <div style="padding: 15px; background: var(--danger-light); border-left: 4px solid var(--danger-color); border-radius: 8px; margin-bottom: 15px;">
                    <h3 style="color: var(--danger-color); margin-bottom: 10px; font-size: 1rem;">❌ Errors (must fix)</h3>
                    <ul style="margin-left: 20px; color: var(--text-primary);">
                        ${validation.errors.map(e => `<li style="margin-bottom: 5px;">${e.message}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            errorsDiv.innerHTML = '';
        }

        // Display warnings
        if (validation.warnings.length > 0) {
            warningsDiv.innerHTML = `
                <div style="padding: 15px; background: var(--warning-light); border-left: 4px solid var(--warning-color); border-radius: 8px;">
                    <h3 style="color: var(--warning-color); margin-bottom: 10px; font-size: 1rem;">⚠️ Warnings (review recommended)</h3>
                    <ul style="margin-left: 20px; color: var(--text-primary);">
                        ${validation.warnings.map(w => `<li style="margin-bottom: 5px;">${w.message}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            warningsDiv.innerHTML = '';
        }
    }

    loadWithdrawalSettings() {
        const strategy = this.model.withdrawalStrategy;

        document.getElementById('withdrawalStrategy').value = strategy.type;
        document.getElementById('withdrawalPercentage').value = strategy.withdrawalPercentage;
        document.getElementById('inflationAdjusted').checked = strategy.inflationAdjusted;
        document.getElementById('fixedWithdrawalAmount').value = strategy.fixedAmount;
        document.getElementById('fixedInflationAdjusted').checked = strategy.fixedInflationAdjusted;
        document.getElementById('dynamicInitialRate').value = strategy.dynamicInitialRate;
        document.getElementById('dynamicUpperGuardrail').value = strategy.dynamicUpperGuardrail;
        document.getElementById('dynamicLowerGuardrail').value = strategy.dynamicLowerGuardrail;
        document.getElementById('rmdStartAge').value = strategy.rmdStartAge;
        document.getElementById('withdrawalStartYear').value = strategy.withdrawalStartYear;

        // Set withdrawal mode
        const withdrawalMode = strategy.withdrawalMode || 'always';
        const modeRadio = document.querySelector(`input[name="withdrawalMode"][value="${withdrawalMode}"]`);
        if (modeRadio) modeRadio.checked = true;

        this.toggleWithdrawalSettings(strategy.type);
    }

    initializeCharts() {
        // Account Balances Chart (initialize as null, will be created on first update)
        this.charts.accountBalances = null;

        // Net Worth Chart - Stacked to show investment accounts vs home equity
        const ctx = document.getElementById('netWorthChart').getContext('2d');
        this.charts.netWorth = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Investment Accounts',
                        data: [],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.6)',
                        fill: true,
                        tension: 0.4,
                        stack: 'networth' // Stack these two together
                    },
                    {
                        label: 'Home Equity',
                        data: [],
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.6)',
                        fill: true,
                        tension: 0.4,
                        stack: 'networth' // Stack with investment accounts
                    },
                    {
                        label: 'Total Net Worth',
                        data: [],
                        borderColor: '#1e293b',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        borderWidth: 2,
                        borderDash: [5, 5]
                        // No stack property - will be drawn independently
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        stacked: true,
                        ticks: {
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                }
            }
        });
    }

    updateDashboard() {
        // Update scenario indicator
        this.updateScenarioIndicator();

        console.log('📊 updateDashboard - currentScenarioId:', this.currentScenarioId);
        console.log('📊 Current working data:', {
            rentalPeriods: this.model.housing.rentalPeriods?.length || 0,
            ownedProperties: this.model.housing.ownedProperties?.length || 0,
            accounts: this.model.accounts.length,
            incomes: this.model.incomes.length,
            expenses: this.model.expenses.length
        });

        // this.model always contains the current working data (base plan or loaded scenario)
        // So we can use this.projectionEngine directly which is already pointing to this.model
        const projections = this.projectionEngine.projectNetWorth(40);

        // Update net worth chart with breakdown
        this.charts.netWorth.data.labels = projections.map(p => p.year);
        // Investment accounts (total balance minus debt, excluding home equity)
        this.charts.netWorth.data.datasets[0].data = projections.map(p => p.endBalance - (p.debtBalance || 0));
        // Home equity (home value - mortgage)
        this.charts.netWorth.data.datasets[1].data = projections.map(p => p.homeEquity || 0);
        // Total net worth line
        this.charts.netWorth.data.datasets[2].data = projections.map(p => p.netWorth);

        // Debug: Check first year to verify calculations match
        if (projections.length > 0) {
            const firstYear = projections[0];
            const calculatedNetWorth = firstYear.endBalance + (firstYear.homeEquity || 0) - (firstYear.debtBalance || 0);
            if (Math.abs(calculatedNetWorth - firstYear.netWorth) > 1) {
                console.warn(`Net worth mismatch in year ${firstYear.year}:`,
                    `endBalance=${firstYear.endBalance}, homeEquity=${firstYear.homeEquity || 0}, ` +
                    `debtBalance=${firstYear.debtBalance || 0}, ` +
                    `calculated=${calculatedNetWorth}, stored=${firstYear.netWorth}`);
            }
        }

        this.charts.netWorth.update();

        // Update summary stats
        const currentNetWorth = this.model.accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const projectedNetWorth = projections[projections.length - 1].netWorth;
        const annualIncome = this.model.incomes.reduce((sum, inc) => {
            const amount = inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount;
            return sum + amount;
        }, 0);
        const annualExpenses = this.model.expenses.reduce((sum, exp) => {
            const amount = exp.frequency === 'monthly' ? exp.amount * 12 : exp.amount;
            return sum + amount;
        }, 0);

        // Calculate housing and debt metrics
        let housingMetrics = '';
        let debtMetrics = '';

        // Calculate current housing costs based on active periods
        const currentYear = this.model.settings.planStartYear;
        let totalRentCost = 0;
        let totalHomeValue = 0;
        let totalMortgageBalance = 0;

        // Calculate active rental costs
        if (this.model.housing.rentalPeriods) {
            this.model.housing.rentalPeriods.forEach(rental => {
                if (currentYear >= rental.startYear && (!rental.endYear || currentYear <= rental.endYear)) {
                    const yearsSinceStart = currentYear - rental.startYear;
                    const adjustedRent = rental.monthlyRent * Math.pow(1 + rental.annualIncrease / 100, yearsSinceStart);
                    totalRentCost += adjustedRent * 12;
                }
            });
        }

        // Calculate active owned property values
        if (this.model.housing.ownedProperties) {
            this.model.housing.ownedProperties.forEach(property => {
                if (currentYear >= property.purchaseYear && (!property.sellYear || currentYear < property.sellYear)) {
                    const homeValue = this.projectionEngine.calculateHomeValueForYear(property, currentYear);
                    const mortgageData = this.projectionEngine.calculateMortgageBalanceForYear(property, currentYear);
                    totalHomeValue += homeValue;
                    totalMortgageBalance += mortgageData.balance;
                }
            });
        }

        // Build housing metrics HTML
        const housingItems = [];
        if (totalRentCost > 0) {
            housingItems.push(`
                <div class="stat-item">
                    <div class="stat-label">Rent</div>
                    <div class="stat-value">$${Math.round(totalRentCost).toLocaleString()}/yr</div>
                </div>
            `);
        }
        if (totalHomeValue > 0) {
            const equity = totalHomeValue - totalMortgageBalance;
            housingItems.push(`
                <div class="stat-item">
                    <div class="stat-label">Home Value</div>
                    <div class="stat-value">$${Math.round(totalHomeValue).toLocaleString()}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Home Equity</div>
                    <div class="stat-value">$${Math.round(equity).toLocaleString()}</div>
                </div>
            `);
        }
        housingMetrics = housingItems.join('');

        const totalCreditCardDebt = this.model.debts.creditCards.reduce((sum, card) => sum + card.balance, 0);
        const totalLoanDebt = this.model.debts.loans.reduce((sum, loan) => sum + loan.balance, 0);
        const totalDebt = totalCreditCardDebt + totalLoanDebt;

        if (totalDebt > 0) {
            const year = this.model.settings.planStartYear;
            const debtData = this.projectionEngine.calculateDebtCostsForYear(year);
            debtMetrics = `
                <div class="stat-item">
                    <div class="stat-label">Total Debt</div>
                    <div class="stat-value danger">$${totalDebt.toLocaleString()}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Annual Debt Payments</div>
                    <div class="stat-value">$${debtData.totalPayment.toLocaleString()}</div>
                </div>
            `;
        }

        document.getElementById('summaryStats').innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Current Net Worth</div>
                <div class="stat-value">$${currentNetWorth.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Projected Net Worth (40 years)</div>
                <div class="stat-value">$${projectedNetWorth.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Annual Income</div>
                <div class="stat-value">$${annualIncome.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Annual Expenses</div>
                <div class="stat-value">$${annualExpenses.toLocaleString()}</div>
            </div>
            ${housingMetrics}
            ${debtMetrics}
            <div class="stat-item">
                <div class="stat-label">Annual Savings</div>
                <div class="stat-value ${annualIncome - annualExpenses >= 0 ? '' : 'danger'}">
                    $${(annualIncome - annualExpenses).toLocaleString()}
                </div>
            </div>
        `;

        // Update cash flow breakdown
        try {
            this.updateCashFlowBreakdown(projections);
        } catch (e) {
            console.error('Error updating cash flow breakdown:', e);
        }

        // Update Sankey diagram (current year using projection data)
        try {
            this.updateSankeyDiagram(annualIncome, annualExpenses, this.model);
        } catch (e) {
            console.error('Error updating Sankey diagram:', e);
        }

        // Populate future Sankey year selector
        try {
            const yearSelector = document.getElementById('futureSankeyYear');
            if (yearSelector) {
                yearSelector.innerHTML = projections.map(p =>
                    `<option value="${p.year}">${p.year}</option>`
                ).join('');
            }
        } catch (e) {
            console.error('Error populating year selector:', e);
        }

        // Update account balances chart
        try {
            this.updateAccountBalancesChart(projections);
        } catch (e) {
            console.error('Error updating account balances chart:', e);
        }

        // Update lists
        try {
            this.updateAccountsList();
            this.updateIncomeList();
            this.updateExpensesList();
            this.updateMilestonesList();
        } catch (e) {
            console.error('Error updating lists:', e);
        }
    }

    updateAccountBalancesChart(projections) {
        const ctx = document.getElementById('accountBalancesChart');
        if (!ctx) return;

        // Check for empty projections
        if (!projections || projections.length === 0) {
            console.warn('No projection data - skipping account balances chart');
            if (this.charts.accountBalances) {
                this.charts.accountBalances.destroy();
                this.charts.accountBalances = null;
            }
            return;
        }

        // Destroy existing chart
        if (this.charts.accountBalances) {
            this.charts.accountBalances.destroy();
        }

        // Prepare datasets by account type
        const years = projections.map(p => p.year);
        const accountTypes = ['cash', 'taxable', 'traditional', 'roth', 'hsa'];
        const typeColors = {
            cash: 'rgba(156, 163, 175, 0.8)',      // gray
            taxable: 'rgba(16, 185, 129, 0.8)',    // green
            traditional: 'rgba(251, 191, 36, 0.8)', // yellow
            roth: 'rgba(59, 130, 246, 0.8)',       // blue
            hsa: 'rgba(139, 92, 246, 0.8)'         // purple
        };

        const typeLabels = {
            cash: 'Cash',
            taxable: 'Taxable',
            traditional: 'Traditional IRA/401k',
            roth: 'Roth IRA',
            hsa: 'HSA'
        };

        const datasets = accountTypes.map(type => {
            const data = projections.map(p => {
                if (!p.accountBalances) return 0;
                return p.accountBalances
                    .filter(acc => acc.type === type)
                    .reduce((sum, acc) => sum + acc.balance, 0);
            });

            return {
                label: typeLabels[type] || type,
                data: data,
                backgroundColor: typeColors[type],
                borderColor: typeColors[type].replace('0.8', '1'),
                borderWidth: 1,
                fill: true
            };
        }).filter(ds => ds.data.some(val => val > 0)); // Only show types with balances

        // If no datasets have data, don't create the chart
        if (datasets.length === 0) {
            console.warn('No account balance data to display');
            return;
        }

        this.charts.accountBalances = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' +
                                    context.parsed.y.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Year'
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Balance ($)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + (value / 1000).toFixed(0) + 'k';
                            }
                        }
                    }
                }
            }
        });
    }

    updateCashFlowBreakdown(projections) {
        const currentYear = this.model.settings.planStartYear;

        // Show all years of the projection
        const yearsToShow = projections;

        let html = `
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button id="cashFlowTableView" class="btn btn-secondary" style="flex: 1;">📊 Table View</button>
                <button id="cashFlowChartView" class="btn btn-secondary" style="flex: 1;">📈 Chart View</button>
            </div>
            <div id="cashFlowTableContent" style="display: block;">
                <div style="max-height: 500px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="position: sticky; top: 0; background: var(--bg-color); z-index: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <tr style="border-bottom: 2px solid var(--border-color);">
                                <th style="text-align: left; padding: 8px;">Year</th>
                                <th style="text-align: right; padding: 8px;" title="Salary, SS, Pension">Work/SS/Pension</th>
                                <th style="text-align: right; padding: 8px; color: var(--success-color);" title="Investment returns, dividends, interest">Investment Income</th>
                                <th style="text-align: right; padding: 8px; color: var(--danger-color);">Taxes</th>
                                <th style="text-align: right; padding: 8px; color: var(--danger-color);">Expenses</th>
                                <th style="text-align: right; padding: 8px; font-weight: 600;">Total Income</th>
                                <th style="text-align: right; padding: 8px; color: var(--success-color); font-weight: 600;">Net Savings</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        yearsToShow.forEach((p, index) => {
            const totalIncome = p.income + (p.investmentReturns || 0);
            const netSavings = totalIncome - (p.taxes || 0) - p.expenses;
            const savingsColor = netSavings >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            const bgColor = index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)';

            html += `
                <tr style="background: ${bgColor}; border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 6px; font-weight: ${p.income === 0 ? '500' : 'normal'};">${p.year}</td>
                    <td style="text-align: right; padding: 6px; ${p.income === 0 ? 'color: var(--text-secondary); font-style: italic;' : ''}">
                        ${p.income > 0 ? '$' + Math.round(p.income).toLocaleString() : '—'}
                    </td>
                    <td style="text-align: right; padding: 6px; color: var(--success-color);">
                        $${Math.round(p.investmentReturns || 0).toLocaleString()}
                    </td>
                    <td style="text-align: right; padding: 6px; color: var(--danger-color);">
                        -$${Math.round(p.taxes || 0).toLocaleString()}
                    </td>
                    <td style="text-align: right; padding: 6px; color: var(--danger-color);">
                        -$${Math.round(p.expenses).toLocaleString()}
                    </td>
                    <td style="text-align: right; padding: 6px; font-weight: 500;">
                        $${Math.round(totalIncome).toLocaleString()}
                    </td>
                    <td style="text-align: right; padding: 6px; font-weight: 600; color: ${savingsColor};">
                        ${netSavings >= 0 ? '+' : ''}$${Math.round(netSavings).toLocaleString()}
                    </td>
                </tr>
            `;
        });

        // Add totals row
        const totals = yearsToShow.reduce((acc, p) => ({
            workIncome: acc.workIncome + p.income,
            investmentIncome: acc.investmentIncome + (p.investmentReturns || 0),
            taxes: acc.taxes + (p.taxes || 0),
            expenses: acc.expenses + p.expenses
        }), { workIncome: 0, investmentIncome: 0, taxes: 0, expenses: 0 });

        const totalIncome = totals.workIncome + totals.investmentIncome;
        const totalNetSavings = totalIncome - totals.taxes - totals.expenses;
        const totalSavingsColor = totalNetSavings >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        html += `
                <tr style="border-top: 3px solid var(--border-color); background: var(--primary-light); font-weight: 600;">
                    <td style="padding: 10px;">Total (${yearsToShow.length} yrs)</td>
                    <td style="text-align: right; padding: 10px;">$${Math.round(totals.workIncome).toLocaleString()}</td>
                    <td style="text-align: right; padding: 10px; color: var(--success-color);">$${Math.round(totals.investmentIncome).toLocaleString()}</td>
                    <td style="text-align: right; padding: 10px; color: var(--danger-color);">-$${Math.round(totals.taxes).toLocaleString()}</td>
                    <td style="text-align: right; padding: 10px; color: var(--danger-color);">-$${Math.round(totals.expenses).toLocaleString()}</td>
                    <td style="text-align: right; padding: 10px;">$${Math.round(totalIncome).toLocaleString()}</td>
                    <td style="text-align: right; padding: 10px; color: ${totalSavingsColor};">
                        ${totalNetSavings >= 0 ? '+' : ''}$${Math.round(totalNetSavings).toLocaleString()}
                    </td>
                </tr>
            </tbody>
        </table>
                </div>
            </div>
            <div id="cashFlowChartContent" style="display: none; height: 500px;">
                <canvas id="cashFlowChart"></canvas>
            </div>
            <div style="margin-top: 15px; padding: 12px; background: var(--primary-light); border-radius: 8px; font-size: 13px; color: var(--text-secondary);">
                <strong>💡 Understanding Your Cash Flow:</strong><br>
                • <strong>Work/SS/Pension:</strong> Active income from work, Social Security, and pensions<br>
                • <strong>Investment Income:</strong> Returns from your portfolio (stocks, bonds, etc.)<br>
                • <strong>Total Income:</strong> Sum of all income sources<br>
                • <strong>Net Savings:</strong> Total Income - Taxes - Expenses (positive = growing wealth, negative = drawing down)<br>
                ${totals.taxes > 0 && totals.workIncome > 0 ? `<br><strong>💸 Tax Impact:</strong> Paying average $${Math.round(totals.taxes / yearsToShow.length).toLocaleString()}/year (${Math.round(totals.taxes / totals.workIncome * 100)}% effective rate on work income)` : ''}
                ${totals.investmentIncome > totals.workIncome * 2 ? `<br><strong>📈 Milestone:</strong> Your investments are generating significant income! Investment returns (${Math.round(totals.investmentIncome / totalIncome * 100)}% of total) are working hard for you.` : ''}
            </div>
        `;

        document.getElementById('cashFlowBreakdown').innerHTML = html;

        // Setup view toggle buttons
        const tableViewBtn = document.getElementById('cashFlowTableView');
        const chartViewBtn = document.getElementById('cashFlowChartView');
        const tableContent = document.getElementById('cashFlowTableContent');
        const chartContent = document.getElementById('cashFlowChartContent');

        tableViewBtn.addEventListener('click', () => {
            tableContent.style.display = 'block';
            chartContent.style.display = 'none';
            tableViewBtn.classList.add('btn-primary');
            tableViewBtn.classList.remove('btn-secondary');
            chartViewBtn.classList.remove('btn-primary');
            chartViewBtn.classList.add('btn-secondary');
        });

        chartViewBtn.addEventListener('click', () => {
            tableContent.style.display = 'none';
            chartContent.style.display = 'block';
            chartViewBtn.classList.add('btn-primary');
            chartViewBtn.classList.remove('btn-secondary');
            tableViewBtn.classList.remove('btn-primary');
            tableViewBtn.classList.add('btn-secondary');

            // Create chart if not exists
            this.createCashFlowChart(yearsToShow);
        });

        // Set default view
        tableViewBtn.classList.add('btn-primary');
        tableViewBtn.classList.remove('btn-secondary');
    }

    createCashFlowChart(yearsToShow) {
        const ctx = document.getElementById('cashFlowChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.cashFlow) {
            this.charts.cashFlow.destroy();
        }

        this.charts.cashFlow = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: yearsToShow.map(p => p.year),
                datasets: [
                    {
                        label: 'Work/SS/Pension Income',
                        data: yearsToShow.map(p => Math.round(p.income)),
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1,
                        stack: 'income'
                    },
                    {
                        label: 'Investment Returns',
                        data: yearsToShow.map(p => Math.round(p.investmentReturns || 0)),
                        backgroundColor: 'rgba(16, 185, 129, 0.5)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1,
                        stack: 'income'
                    },
                    {
                        label: 'Taxes',
                        data: yearsToShow.map(p => -Math.round(p.taxes || 0)),
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        stack: 'expenses'
                    },
                    {
                        label: 'Expenses',
                        data: yearsToShow.map(p => -Math.round(p.expenses)),
                        backgroundColor: 'rgba(251, 146, 60, 0.7)',
                        borderColor: 'rgba(251, 146, 60, 1)',
                        borderWidth: 1,
                        stack: 'expenses'
                    },
                    {
                        label: 'Net Savings',
                        data: yearsToShow.map(p => Math.round(p.income + (p.investmentReturns || 0) - (p.taxes || 0) - p.expenses)),
                        backgroundColor: 'rgba(59, 130, 246, 0.9)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 3,
                        type: 'line',
                        pointRadius: 2,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Annual Cash Flow (${yearsToShow.length} Year Projection)`,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const value = context.parsed.y;
                                label += (value >= 0 ? '$' : '-$') + Math.abs(value).toLocaleString();
                                return label;
                            },
                            footer: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const p = yearsToShow[index];
                                const totalIncome = p.income + (p.investmentReturns || 0);
                                return `Total Income: $${Math.round(totalIncome).toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                const absValue = Math.abs(value);
                                if (absValue >= 1000000) {
                                    return (value >= 0 ? '$' : '-$') + (absValue / 1000000).toFixed(1) + 'M';
                                }
                                return (value >= 0 ? '$' : '-$') + (absValue / 1000).toFixed(0) + 'k';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Year'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 20
                        }
                    }
                }
            }
        });
    }

    updateSankeyDiagram(income, expenses, dataModel = null) {
        // Use unified Sankey renderer for current year
        const model = dataModel || this.model;
        const currentYear = model.settings.planStartYear;
        this.renderSankeyForYear(currentYear, 'sankeyChart', false, model);
    }

    updateFutureSankey() {
        // this.model always contains the current working data (base plan or loaded scenario)
        const selectedYear = parseInt(document.getElementById('futureSankeyYear').value);
        this.renderSankeyForYear(selectedYear, 'futureSankeyChart', true, null);
    }

    // UNIFIED SANKEY RENDERER - works for both current and future years
    renderSankeyForYear(selectedYear, chartElementId, showYearLabel, dataModel = null) {
        const model = dataModel || this.model;
        const engine = dataModel ? new ProjectionEngine(dataModel) : this.projectionEngine;
        const currentYear = model.settings.planStartYear;
        const horizon = parseInt(model.settings.projectionHorizon || 40);
        const projections = engine.projectNetWorth(horizon);

        // Check for empty projections
        if (!projections || projections.length === 0) {
            console.warn('No projection data available - skipping Sankey render');
            document.getElementById(chartElementId).innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b;">No data to display. Add accounts, income, and expenses to see cash flow.</p>';
            return;
        }

        // Find the projection for the selected year
        const yearData = projections.find(p => p.year === selectedYear);
        if (!yearData) {
            console.warn(`Unable to find projection data for year ${selectedYear}`);
            document.getElementById(chartElementId).innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b;">No data for selected year.</p>';
            return;
        }

        // Calculate income components for that year
        let annualIncome = yearData.income;
        let annualExpenses = yearData.expenses;

        // Check if there's any meaningful data to display
        if (!annualIncome || annualIncome === 0) {
            document.getElementById(chartElementId).innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b;">Add income sources to see cash flow visualization.</p>';
            return;
        }

        // Generate Sankey diagram
        const width = document.getElementById(chartElementId).offsetWidth || 800;
        const height = 500;

        // Clear previous diagram
        d3.select('#' + chartElementId).html('');

        const svg = d3.select('#' + chartElementId)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Add year label (optional for future year charts)
        if (showYearLabel) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 25)
                .attr('text-anchor', 'middle')
                .attr('font-size', '18px')
                .attr('font-weight', 'bold')
                .attr('fill', '#1e293b')
                .text(`Cash Flow Projection for ${selectedYear}`);
        }

        // Collect income sources for that year
        const incomeSources = [];

        // Work income
        model.incomes.forEach(income => {
            if (selectedYear >= income.startYear && (!income.endYear || selectedYear <= income.endYear)) {
                const yearsSinceStart = selectedYear - income.startYear;
                const adjustedAmount = income.amount * Math.pow(1 + income.growth / 100, yearsSinceStart);
                const annualAmount = income.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                if (annualAmount > 0) {
                    incomeSources.push({
                        name: income.name,
                        amount: annualAmount,
                        category: income.category || 'salary'
                    });
                }
            }
        });

        // Social Security Person A
        const personA = model.settings.household.personA;
        if (personA.socialSecurity && personA.socialSecurity.enabled) {
            const personAAge = selectedYear - personA.birthYear;
            if (personAAge >= personA.socialSecurity.startAge) {
                const startYear = personA.birthYear + personA.socialSecurity.startAge;
                const yearsSinceSSStart = Math.max(0, selectedYear - startYear);
                const inflationRate = model.settings.inflation / 100;
                const adjustedSS = personA.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                incomeSources.push({
                    name: `${personA.name} Social Security`,
                    amount: adjustedSS,
                    category: 'social_security'
                });
            }
        }

        // Social Security Person B
        const personB = model.settings.household.personB;
        if (personB && personB.socialSecurity && personB.socialSecurity.enabled) {
            const personBAge = selectedYear - personB.birthYear;
            if (personBAge >= personB.socialSecurity.startAge) {
                const startYear = personB.birthYear + personB.socialSecurity.startAge;
                const yearsSinceSSStart = Math.max(0, selectedYear - startYear);
                const inflationRate = model.settings.inflation / 100;
                const adjustedSS = personB.socialSecurity.annualAmount * Math.pow(1 + inflationRate, yearsSinceSSStart);
                incomeSources.push({
                    name: `${personB.name} Social Security`,
                    amount: adjustedSS,
                    category: 'social_security'
                });
            }
        }

        // Pension
        const pension = model.settings.pension;
        if (pension && pension.enabled && selectedYear >= pension.startYear) {
            const yearsSinceStart = selectedYear - pension.startYear;
            const adjustedPension = pension.annualAmount * Math.pow(1 + pension.growth / 100, yearsSinceStart);
            incomeSources.push({
                name: pension.name || 'Pension',
                amount: adjustedPension,
                category: 'pension'
            });
        }

        // Milestone windfalls (inheritance, gifts, etc.)
        model.milestones.forEach(milestone => {
            if (milestone.year === selectedYear && milestone.isPositive) {
                incomeSources.push({
                    name: milestone.name,
                    amount: milestone.cost,
                    category: 'other'
                });
            }
            // Recurring windfalls - must apply growth rate and interval logic
            if (milestone.recurring && selectedYear >= milestone.year && milestone.isPositive) {
                const yearsSinceStart = selectedYear - milestone.year;
                const interval = milestone.recurringInterval || 1;

                // Check if this year matches the interval (e.g., year 0, 8, 16, 24...)
                if (yearsSinceStart % interval === 0) {
                    // Apply growth rate (compounds from start year)
                    const growthRate = (milestone.recurringGrowth || 0) / 100;
                    const adjustedAmount = milestone.recurringAmount * Math.pow(1 + growthRate, yearsSinceStart);

                    incomeSources.push({
                        name: `${milestone.name} (recurring)`,
                        amount: adjustedAmount,
                        category: 'other'
                    });
                }
            }
        });

        // Note: Investment returns stay in portfolio - they're not "income" for spending
        // Only show withdrawals as actual usable cash flow

        // Break down withdrawals by account type using actual withdrawal data
        if (yearData.withdrawals > 0) {
            if (yearData.withdrawalsByType && Object.keys(yearData.withdrawalsByType).length > 0) {
                const typeLabels = {
                    cash: 'Cash/Savings',
                    taxable: 'Taxable Brokerage',
                    traditional: 'Traditional IRA/401k',
                    roth: 'Roth IRA',
                    hsa: 'HSA'
                };

                // Use actual withdrawal breakdown from projection
                Object.keys(yearData.withdrawalsByType).forEach(accountType => {
                    const amount = yearData.withdrawalsByType[accountType];
                    if (amount > 0.01) { // Only show significant amounts
                        const label = typeLabels[accountType] || accountType; // Fallback to raw type if not in map
                        incomeSources.push({
                            name: label + ' Withdrawal',
                            amount: amount,
                            category: 'withdrawal_' + accountType  // Special category for withdrawal colors
                        });
                    }
                });
            } else {
                // Fallback: withdrawalsByType is missing or empty, but we have total withdrawals
                console.warn(`Year ${selectedYear}: withdrawalsByType is empty but withdrawals=$${yearData.withdrawals} - using fallback`);
                incomeSources.push({
                    name: 'Portfolio Withdrawals',
                    amount: yearData.withdrawals,
                    category: 'withdrawal_general'
                });
            }
        }

        // Taxable milestone income (e.g., student loan forgiveness "tax bombs")
        // This is phantom income - no cash received, but taxed as income
        // DO NOT add to incomeSources - it's not real cash flow, just affects tax calculation
        // The tax impact is already captured in yearData.taxes
        // if (yearData.milestoneTaxableIncome && yearData.milestoneTaxableIncome > 0) {
        //     // Find which milestone(s) created this taxable income
        //     this.model.milestones.forEach(milestone => {
        //         if (milestone.year === selectedYear && milestone.isTaxable && milestone.taxableAmount > 0) {
        //             incomeSources.push({
        //                 name: `${milestone.name} (taxable income)`,
        //                 amount: milestone.taxableAmount
        //             });
        //         }
        //     });
        // }

        // Calculate total collected income
        let totalCollected = 0;
        incomeSources.forEach(src => {
            totalCollected += src.amount;
        });

        // Collect expenses by category for that year
        const expensesByCategory = {};
        model.expenses.forEach(exp => {
            if (selectedYear >= exp.startYear && (!exp.endYear || selectedYear <= exp.endYear)) {
                const yearsSinceStart = selectedYear - exp.startYear;
                const adjustedAmount = exp.amount * Math.pow(1 + exp.growth / 100, yearsSinceStart);
                const annualAmount = exp.frequency === 'monthly' ? adjustedAmount * 12 : adjustedAmount;
                if (expensesByCategory[exp.category]) {
                    expensesByCategory[exp.category] += annualAmount;
                } else {
                    expensesByCategory[exp.category] = annualAmount;
                }
            }
        });

        // Add milestone costs as one-time expenses
        model.milestones.forEach(milestone => {
            if (milestone.year === selectedYear && !milestone.isPositive && milestone.cost > 0) {
                const category = 'milestone_costs';
                const displayName = milestone.name;
                // Add as separate expense item, not grouped by category
                if (expensesByCategory[displayName]) {
                    expensesByCategory[displayName] += milestone.cost;
                } else {
                    expensesByCategory[displayName] = milestone.cost;
                }
            }
            // Recurring milestone costs - must apply growth rate and interval logic
            if (milestone.recurring && selectedYear >= milestone.year && !milestone.isPositive) {
                const yearsSinceStart = selectedYear - milestone.year;
                const interval = milestone.recurringInterval || 1;

                // Check if this year matches the interval (e.g., year 0, 8, 16, 24...)
                if (yearsSinceStart % interval === 0) {
                    // Apply growth rate (compounds from start year)
                    const growthRate = (milestone.recurringGrowth || 0) / 100;
                    const adjustedAmount = milestone.recurringAmount * Math.pow(1 + growthRate, yearsSinceStart);

                    const displayName = `${milestone.name} (recurring)`;
                    if (expensesByCategory[displayName]) {
                        expensesByCategory[displayName] += adjustedAmount;
                    } else {
                        expensesByCategory[displayName] = adjustedAmount;
                    }
                }
            }
        });

        // Add housing costs broken down by component
        if (yearData.rentCost && yearData.rentCost > 0) {
            expensesByCategory['Rent'] = yearData.rentCost;
        }
        if (yearData.mortgageCost && yearData.mortgageCost > 0) {
            expensesByCategory['Mortgage Payment'] = yearData.mortgageCost;
        }
        if (yearData.propertyTaxCost && yearData.propertyTaxCost > 0) {
            expensesByCategory['Property Tax'] = yearData.propertyTaxCost;
        }
        if (yearData.insuranceCost && yearData.insuranceCost > 0) {
            expensesByCategory['Home Insurance'] = yearData.insuranceCost;
        }
        if (yearData.hoaCost && yearData.hoaCost > 0) {
            expensesByCategory['HOA Fees'] = yearData.hoaCost;
        }
        if (yearData.maintenanceCost && yearData.maintenanceCost > 0) {
            expensesByCategory['Home Maintenance'] = yearData.maintenanceCost;
        }

        // Add debt payments
        if (yearData.debtPayments && yearData.debtPayments > 0) {
            expensesByCategory['Debt Payments'] = yearData.debtPayments;
        }

        // Calculate net savings FIRST (needed for color map)
        // Note: annualExpenses from yearData already includes housing and debt costs
        const totalInflows = annualIncome + (yearData.withdrawals || 0) + (yearData.milestoneWindfalls || 0);
        const totalOutflows = yearData.taxes + annualExpenses + (yearData.milestoneCosts || 0);
        const netSavings = totalInflows - totalOutflows;

        // Check balance - in surplus years, netSavings > 0 and gets invested
        // In deficit years, withdrawals cover the gap
        const inflowOutflowDiff = totalCollected - totalOutflows;
        if (Math.abs(inflowOutflowDiff - netSavings) > 1) {
            console.warn(`Sankey imbalance detected in year ${selectedYear}: inflows=${totalCollected.toFixed(2)}, outflows=${totalOutflows.toFixed(2)}, difference=${inflowOutflowDiff.toFixed(2)}`);
        }

        // Helper function to generate color from string (for custom categories)
        const stringToColor = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = hash % 360;
            return `hsl(${hue}, 65%, 55%)`;
        };

        // Define comprehensive color mapping for all income and expense types
        const colorMap = {
            income: {
                salary: '#10b981',           // Emerald green
                business: '#059669',         // Dark emerald
                investment: '#14b8a6',       // Teal
                rental: '#06b6d4',           // Cyan
                pension: '#0ea5e9',          // Sky blue
                social_security: '#3b82f6',  // Blue
                freelance: '#22c55e',        // Green
                other: '#10b981',            // Emerald
                // Withdrawal-specific colors (gradient from green to purple based on tax efficiency)
                withdrawal_cash: '#94a3b8',          // Slate gray
                withdrawal_taxable: '#34d399',       // Light green (most tax-efficient after cash)
                withdrawal_traditional: '#fbbf24',   // Yellow/amber (taxable on withdrawal)
                withdrawal_roth: '#60a5fa',          // Light blue (tax-free - very efficient)
                withdrawal_hsa: '#a78bfa',           // Light purple (tax-advantaged for medical)
                withdrawal_general: '#94a3b8'        // Slate gray
            },
            total: '#475569',                // Darker slate for Total Income node (more prominent)
            expense: {
                housing: '#dc2626',          // Red
                transportation: '#ea580c',   // Orange-red
                food: '#f59e0b',             // Amber
                utilities: '#eab308',        // Yellow
                healthcare: '#06b6d4',       // Cyan
                insurance: '#0284c7',        // Dark cyan
                debt: '#b91c1c',             // Dark red
                education: '#7c3aed',        // Violet
                childcare: '#c026d3',        // Fuchsia
                shopping: '#db2777',         // Pink
                entertainment: '#9333ea',    // Purple
                travel: '#2563eb',           // Blue
                gifts: '#ec4899',            // Hot pink
                savings: '#16a34a',          // Green
                pets: '#65a30d',             // Olive green
                subscriptions: '#4f46e5',    // Indigo
                taxes: '#991b1b',            // Dark red (for tax node)
                other: '#6b7280'             // Gray
            },
            savings: netSavings >= 0 ? '#2563eb' : '#dc2626'  // Blue for surplus, red for deficit
        };

        // Build nodes and links
        const nodes = [];
        const links = [];
        let nodeId = 0;

        // Add income source nodes with category information
        const incomeNodeIds = {};
        incomeSources.forEach(source => {
            nodes.push({
                name: source.name,
                type: 'income',
                category: source.category || 'other'
            });
            incomeNodeIds[source.name] = nodeId++;
        });

        // Add "Total Income" node
        const totalIncomeNodeId = nodeId++;
        nodes.push({ name: 'Total Income', type: 'total' });

        // Add expense category nodes
        const expenseNodeIds = {};
        Object.keys(expensesByCategory).forEach(category => {
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            nodes.push({
                name: categoryName,
                type: 'expense',
                category: category.toLowerCase()
            });
            expenseNodeIds[category] = nodeId++;
        });

        // Add taxes node if there are taxes
        if (yearData.taxes > 0) {
            const taxesNodeId = nodeId++;
            nodes.push({
                name: 'Taxes',
                type: 'expense',
                category: 'taxes'
            });
            links.push({
                source: totalIncomeNodeId,
                target: taxesNodeId,
                value: yearData.taxes
            });
        }

        // Add savings node if positive net savings, or deficit node if negative
        if (netSavings > 0.01) {
            // Surplus year - add savings node (money flows OUT from Total Income)
            const savingsNodeId = nodeId++;
            nodes.push({
                name: 'Savings/Investments',
                type: 'savings'
            });
            links.push({
                source: totalIncomeNodeId,
                target: savingsNodeId,
                value: netSavings
            });
        } else if (netSavings < -0.01) {
            // Deficit year - add "From Returns" node (money flows IN to Total Income)
            // This represents the difference being covered by investment returns
            const deficitNodeId = nodeId++;
            nodes.push({
                name: 'From Investment Returns',
                type: 'income',
                category: 'investment'
            });
            links.push({
                source: deficitNodeId,
                target: totalIncomeNodeId,
                value: Math.abs(netSavings)
            });
        }

        // Create links from income sources to total income
        incomeSources.forEach(source => {
            links.push({
                source: incomeNodeIds[source.name],
                target: totalIncomeNodeId,
                value: source.amount
            });
        });

        // Create links from total income to expense categories
        Object.keys(expensesByCategory).forEach(category => {
            links.push({
                source: totalIncomeNodeId,
                target: expenseNodeIds[category],
                value: expensesByCategory[category]
            });
        });

        // Create Sankey diagram
        const sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(15)
            .extent([[50, 60], [width - 50, height - 50]]);

        const { nodes: sankeyNodes, links: sankeyLinks } = sankey({
            nodes: nodes.map(d => Object.assign({}, d)),
            links: links.map(d => Object.assign({}, d))
        });

        // Draw links with color based on source node type and category
        svg.append('g')
            .selectAll('path')
            .data(sankeyLinks)
            .join('path')
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('stroke', d => {
                const sourceNode = d.source;
                const targetNode = d.target;

                // Color based on the flow source
                if (sourceNode.type === 'income') {
                    return colorMap.income[sourceNode.category] || stringToColor(sourceNode.category);
                }
                if (sourceNode.type === 'total') {
                    // Color based on target when flowing from Total Income
                    if (targetNode.type === 'expense') {
                        return colorMap.expense[targetNode.category] || stringToColor(targetNode.category);
                    }
                    if (targetNode.type === 'savings') {
                        return colorMap.savings;
                    }
                }
                return '#94a3b8';  // Default gray
            })
            .attr('stroke-width', d => Math.max(1, d.width))
            .attr('fill', 'none')
            .attr('opacity', 0.5)
            .append('title')
            .text(d => `${d.source.name} → ${d.target.name}\n$${Math.round(d.value).toLocaleString()}`);

        // Draw nodes with colors based on type and category
        svg.append('g')
            .selectAll('rect')
            .data(sankeyNodes)
            .join('rect')
            .attr('x', d => d.x0)
            .attr('y', d => d.y0)
            .attr('height', d => d.y1 - d.y0)
            .attr('width', d => d.x1 - d.x0)
            .attr('fill', d => {
                if (d.type === 'income') {
                    return colorMap.income[d.category] || stringToColor(d.category);
                }
                if (d.type === 'total') {
                    return colorMap.total;
                }
                if (d.type === 'expense') {
                    return colorMap.expense[d.category] || stringToColor(d.category);
                }
                if (d.type === 'savings') {
                    return colorMap.savings;
                }
                return '#64748b';  // Default gray
            })
            .attr('rx', 3)
            .append('title')
            .text(d => `${d.name}\n$${Math.round(d.value).toLocaleString()}`);

        // Add labels
        svg.append('g')
            .selectAll('text')
            .data(sankeyNodes)
            .join('text')
            .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr('y', d => (d.y1 + d.y0) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
            .attr('font-size', '12px')
            .attr('font-weight', '500')
            .attr('fill', '#1e293b')
            .text(d => d.name);

        // Add value labels
        svg.append('g')
            .selectAll('text.value')
            .data(sankeyNodes)
            .join('text')
            .attr('class', 'value')
            .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr('y', d => (d.y1 + d.y0) / 2 + 14)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
            .attr('font-size', '11px')
            .attr('fill', '#64748b')
            .text(d => `$${Math.round(d.value).toLocaleString()}`);
    }

    updateAccountsList() {
        const container = document.getElementById('accountsList');
        const taxLabels = {
            'traditional': '💼 Tax-Deferred (taxed on withdrawal)',
            'roth': '🎯 Tax-Free Growth (already taxed)',
            'hsa': '🏥 Tax-Advantaged (medical)',
            'taxable': '💵 Taxable',
            'cash': '💵 Taxable'
        };
        container.innerHTML = '<div class="item-list">' +
            this.model.accounts.map(account => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>${account.name}</h3>
                        <p>${account.type} - Balance: $${account.balance.toLocaleString()} - Rate: ${account.interestRate}%</p>
                        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 5px;">
                            ${taxLabels[account.type] || '💵 Taxable'}
                        </p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-secondary" onclick="ui.editAccount(${account.id})">Edit</button>
                        <button class="btn btn-danger" onclick="ui.deleteAccount(${account.id})">Delete</button>
                    </div>
                </div>
            `).join('') +
        '</div>';
    }

    updateIncomeList() {
        const container = document.getElementById('incomeList');
        const categoryLabels = {
            salary: 'Salary/Wages',
            business: 'Business Income',
            investment: 'Investment Income',
            rental: 'Rental Income',
            pension: 'Pension',
            social_security: 'Social Security',
            freelance: 'Freelance/Contract',
            other: 'Other'
        };
        container.innerHTML = '<div class="item-list">' +
            this.model.incomes.map(income => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>${income.name}</h3>
                        <p>${categoryLabels[income.category] || income.category || 'Salary/Wages'} - $${income.amount.toLocaleString()}/${income.frequency} - Growth: ${income.growth}% - Years: ${income.startYear}-${income.endYear || 'ongoing'}</p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-secondary" onclick="ui.editIncome(${income.id})">Edit</button>
                        <button class="btn btn-danger" onclick="ui.deleteIncome(${income.id})">Delete</button>
                    </div>
                </div>
            `).join('') +
        '</div>';
    }

    updateExpensesList() {
        const container = document.getElementById('expensesList');

        // Helper function to format category name for display
        const formatCategory = (category) => {
            // If it's a known category, show proper name
            const categoryNames = {
                housing: 'Housing',
                transportation: 'Transportation',
                food: 'Food & Dining',
                utilities: 'Utilities',
                healthcare: 'Healthcare',
                insurance: 'Insurance',
                debt: 'Debt Payments',
                education: 'Education',
                childcare: 'Childcare',
                shopping: 'Shopping & Personal',
                entertainment: 'Entertainment & Recreation',
                travel: 'Travel & Vacation',
                gifts: 'Gifts & Donations',
                savings: 'Savings & Investments',
                pets: 'Pets',
                subscriptions: 'Subscriptions & Memberships',
                other: 'Other'
            };

            // If it's a known category, return the proper name
            if (categoryNames[category]) {
                return categoryNames[category];
            }

            // Otherwise, format the custom category name (replace _ with space, capitalize)
            return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        };

        container.innerHTML = '<div class="item-list">' +
            this.model.expenses.map(expense => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>${expense.name}</h3>
                        <p>${formatCategory(expense.category)} - $${expense.amount.toLocaleString()}/${expense.frequency} - Growth: ${expense.growth}% - Years: ${expense.startYear}-${expense.endYear || 'ongoing'}</p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-secondary" onclick="ui.editExpense(${expense.id})">Edit</button>
                        <button class="btn btn-danger" onclick="ui.deleteExpense(${expense.id})">Delete</button>
                    </div>
                </div>
            `).join('') +
        '</div>';
    }

    updateMilestonesList() {
        const container = document.getElementById('milestonesList');
        container.innerHTML = '<div class="item-list">' +
            this.model.milestones.map(milestone => {
                const label = milestone.isPositive ? 'Gain' : 'Cost';
                const sign = milestone.isPositive ? '+' : '-';
                return `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>${milestone.name} ${milestone.isPositive ? '💰' : ''}</h3>
                        <p>${milestone.type} - Year: ${milestone.year} - ${label}: ${sign}$${milestone.cost.toLocaleString()}</p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-secondary" onclick="ui.editMilestone(${milestone.id})">Edit</button>
                        <button class="btn btn-danger" onclick="ui.deleteMilestone(${milestone.id})">Delete</button>
                    </div>
                </div>
                `;
            }).join('') +
        '</div>';
    }

    showAccountModal() {
        const modal = this.createModal('Add Account', `
            <div class="form-group">
                <label>Account Name</label>
                <input type="text" id="accountName" placeholder="e.g., Checking Account">
            </div>
            <div class="form-group">
                <label>Account Type</label>
                <select id="accountType">
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Taxable Investment</option>
                    <option value="traditional">Traditional 401k/IRA (tax-deferred)</option>
                    <option value="roth">Roth 401k/IRA (tax-free growth)</option>
                    <option value="hsa">HSA (Health Savings Account)</option>
                </select>
                <small style="color: var(--text-secondary); display: block; margin-top: 5px;">
                    Traditional: Pay taxes on withdrawal | Roth: Already taxed, withdraw tax-free
                </small>
            </div>
            <div class="form-group">
                <label>Current Balance</label>
                <input type="number" id="accountBalance" placeholder="0">
            </div>
            <div class="form-group">
                <label>Interest/Return Rate (%)</label>
                <input type="number" id="accountRate" placeholder="7" step="0.1">
            </div>
            <button class="btn btn-primary" id="saveAccountModalBtn">Add Account</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener after modal is in DOM
        const saveBtn = document.getElementById('saveAccountModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.addAccount());
        }
    }

    addAccount() {
        try {
            const name = document.getElementById('accountName').value;
            const type = document.getElementById('accountType').value;
            const balance = document.getElementById('accountBalance').value;
            const rate = document.getElementById('accountRate').value;

            if (!name || name.trim() === '') {
                alert('Please enter an account name');
                return;
            }

            console.log('UIController.addAccount called');
            console.log('this:', this);
            console.log('this.model:', this.model);
            console.log('this.model.accounts:', this.model.accounts);
            console.log('Is accounts an array?', Array.isArray(this.model.accounts));
            console.log('Type of this.model.addAccount:', typeof this.model.addAccount);

            // Directly add to array instead of using addAccount method
            const accountTypeMap = {
                'checking': 'cash',
                'savings': 'cash',
                'investment': 'taxable',
                'retirement': 'traditional',
                'taxable': 'taxable',
                'traditional': 'traditional',
                'roth': 'roth',
                'hsa': 'hsa',
                'cash': 'cash'
            };

            const normalizedType = accountTypeMap[type] || 'taxable';

            if (!Array.isArray(this.model.accounts)) {
                console.error('this.model.accounts is not an array! Resetting to empty array.');
                this.model.accounts = [];
            }

            this.model.accounts.push({
                id: Date.now(),
                name: name,
                type: normalizedType,
                originalType: type,
                balance: parseFloat(balance) || 0,
                interestRate: parseFloat(rate) || 0,
                taxAdvantaged: normalizedType === 'traditional' || normalizedType === 'roth' || normalizedType === 'hsa'
            });

            console.log('Account added successfully. Total accounts:', this.model.accounts.length);

            this.closeModal();
            this.updateDashboard();
            this.saveData();
        } catch (error) {
            console.error('Error adding account:', error);
            console.error('Stack trace:', error.stack);
            alert('Error adding account: ' + error.message);
        }
    }

    editAccount(id) {
        const account = this.model.accounts.find(a => a.id === id);
        if (!account) {
            alert('Account not found');
            return;
        }

        const modal = this.createModal('Edit Account', `
            <div class="form-group">
                <label>Account Name</label>
                <input type="text" id="accountName" placeholder="e.g., Checking Account" value="${account.name}">
            </div>
            <div class="form-group">
                <label>Account Type</label>
                <select id="accountType">
                    <option value="checking" ${(account.originalType || account.type) === 'checking' ? 'selected' : ''}>Checking</option>
                    <option value="savings" ${(account.originalType || account.type) === 'savings' ? 'selected' : ''}>Savings</option>
                    <option value="investment" ${(account.originalType || account.type) === 'investment' || (account.originalType || account.type) === 'taxable' ? 'selected' : ''}>Taxable Investment</option>
                    <option value="traditional" ${(account.originalType || account.type) === 'traditional' || (account.originalType || account.type) === 'retirement' ? 'selected' : ''}>Traditional 401k/IRA (tax-deferred)</option>
                    <option value="roth" ${(account.originalType || account.type) === 'roth' ? 'selected' : ''}>Roth 401k/IRA (tax-free growth)</option>
                    <option value="hsa" ${(account.originalType || account.type) === 'hsa' ? 'selected' : ''}>HSA (Health Savings Account)</option>
                </select>
                <small style="color: var(--text-secondary); display: block; margin-top: 5px;">
                    Traditional: Pay taxes on withdrawal | Roth: Already taxed, withdraw tax-free
                </small>
            </div>
            <div class="form-group">
                <label>Current Balance</label>
                <input type="number" id="accountBalance" placeholder="0" value="${account.balance}">
            </div>
            <div class="form-group">
                <label>Interest/Return Rate (%)</label>
                <input type="number" id="accountRate" placeholder="7" step="0.1" value="${account.interestRate}">
            </div>
            <button class="btn btn-primary" id="updateAccountModalBtn">Update Account</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener after modal is in DOM
        const updateBtn = document.getElementById('updateAccountModalBtn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.updateAccount(id));
        }
    }

    updateAccount(id) {
        try {
            const name = document.getElementById('accountName').value;
            const type = document.getElementById('accountType').value;
            const balance = document.getElementById('accountBalance').value;
            const rate = document.getElementById('accountRate').value;

            if (!name || name.trim() === '') {
                alert('Please enter an account name');
                return;
            }

            const accountTypeMap = {
                'checking': 'cash',
                'savings': 'cash',
                'investment': 'taxable',
                'retirement': 'traditional',
                'taxable': 'taxable',
                'traditional': 'traditional',
                'roth': 'roth',
                'hsa': 'hsa',
                'cash': 'cash'
            };

            const normalizedType = accountTypeMap[type] || 'taxable';

            // Find and update the account
            const account = this.model.accounts.find(a => a.id === id);
            if (account) {
                account.name = name;
                account.type = normalizedType;
                account.originalType = type;
                account.balance = parseFloat(balance) || 0;
                account.interestRate = parseFloat(rate) || 0;
                account.taxAdvantaged = normalizedType === 'traditional' || normalizedType === 'roth' || normalizedType === 'hsa';
            }

            this.closeModal();
            this.updateDashboard();
            this.saveData();
        } catch (error) {
            console.error('Error updating account:', error);
            alert('Error updating account: ' + error.message);
        }
    }

    deleteAccount(id) {
        this.model.removeItem(this.model.accounts, id);
        this.updateDashboard();
        this.saveData();
    }

    showIncomeModal() {
        const currentYear = new Date().getFullYear();
        const modal = this.createModal('Add Income', `
            <div class="form-group">
                <label>Income Name</label>
                <input type="text" id="incomeName" placeholder="e.g., Software Engineering Job">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="incomeCategory">
                    <option value="salary">Salary/Wages</option>
                    <option value="business">Business Income</option>
                    <option value="investment">Investment Income</option>
                    <option value="rental">Rental Income</option>
                    <option value="pension">Pension</option>
                    <option value="social_security">Social Security</option>
                    <option value="freelance">Freelance/Contract</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" id="incomeAmount" placeholder="5000">
            </div>
            <div class="form-group">
                <label>Frequency</label>
                <select id="incomeFrequency">
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                </select>
            </div>
            <div class="form-group">
                <label>Start Year</label>
                <input type="number" id="incomeStartYear" value="${currentYear}">
            </div>
            <div class="form-group">
                <label>End Year (optional)</label>
                <input type="number" id="incomeEndYear" placeholder="Leave empty for ongoing">
            </div>
            <div class="form-group">
                <label>Annual Growth Rate (%)</label>
                <input type="number" id="incomeGrowth" value="3" step="0.1">
            </div>
            <button class="btn btn-primary" id="saveIncomeModalBtn">Add Income</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener
        const saveBtn = document.getElementById('saveIncomeModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.addIncome());
        }
    }

    addIncome() {
        this.model.addIncome({
            name: document.getElementById('incomeName').value,
            amount: document.getElementById('incomeAmount').value,
            frequency: document.getElementById('incomeFrequency').value,
            category: document.getElementById('incomeCategory').value,
            startYear: document.getElementById('incomeStartYear').value,
            endYear: document.getElementById('incomeEndYear').value || null,
            growth: document.getElementById('incomeGrowth').value
        });
        this.closeModal();
        this.updateDashboard();
        this.saveData();
    }

    deleteIncome(id) {
        this.model.removeItem(this.model.incomes, id);
        this.updateDashboard();
        this.saveData();
    }

    editIncome(id) {
        const income = this.model.incomes.find(i => i.id === id);
        if (!income) return;

        const modal = this.createModal('Edit Income', `
            <div class="form-group">
                <label>Income Name</label>
                <input type="text" id="incomeName" value="${income.name}" placeholder="e.g., Software Engineering Job">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="incomeCategory">
                    <option value="salary" ${income.category === 'salary' ? 'selected' : ''}>Salary/Wages</option>
                    <option value="business" ${income.category === 'business' ? 'selected' : ''}>Business Income</option>
                    <option value="investment" ${income.category === 'investment' ? 'selected' : ''}>Investment Income</option>
                    <option value="rental" ${income.category === 'rental' ? 'selected' : ''}>Rental Income</option>
                    <option value="pension" ${income.category === 'pension' ? 'selected' : ''}>Pension</option>
                    <option value="social_security" ${income.category === 'social_security' ? 'selected' : ''}>Social Security</option>
                    <option value="freelance" ${income.category === 'freelance' ? 'selected' : ''}>Freelance/Contract</option>
                    <option value="other" ${income.category === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" id="incomeAmount" value="${income.amount}" placeholder="5000">
            </div>
            <div class="form-group">
                <label>Frequency</label>
                <select id="incomeFrequency">
                    <option value="monthly" ${income.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="annual" ${income.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                </select>
            </div>
            <div class="form-group">
                <label>Start Year</label>
                <input type="number" id="incomeStartYear" value="${income.startYear}">
            </div>
            <div class="form-group">
                <label>End Year (optional)</label>
                <input type="number" id="incomeEndYear" value="${income.endYear || ''}" placeholder="Leave empty for ongoing">
            </div>
            <div class="form-group">
                <label>Annual Growth Rate (%)</label>
                <input type="number" id="incomeGrowth" value="${income.growth}" step="0.1">
            </div>
            <button class="btn btn-primary" id="updateIncomeModalBtn">Update Income</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener
        const saveBtn = document.getElementById('updateIncomeModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.updateIncome(id));
        }
    }

    updateIncome(id) {
        const income = this.model.incomes.find(i => i.id === id);
        if (!income) return;

        income.name = document.getElementById('incomeName').value;
        income.amount = parseFloat(document.getElementById('incomeAmount').value);
        income.frequency = document.getElementById('incomeFrequency').value;
        income.category = document.getElementById('incomeCategory').value;
        income.startYear = parseInt(document.getElementById('incomeStartYear').value);
        income.endYear = parseInt(document.getElementById('incomeEndYear').value) || null;
        income.growth = parseFloat(document.getElementById('incomeGrowth').value);

        this.closeModal();
        this.updateDashboard();
        this.saveData();
    }

    showExpenseModal() {
        const currentYear = new Date().getFullYear();
        const modal = this.createModal('Add Expense', `
            <div class="form-group">
                <label>Expense Name</label>
                <input type="text" id="expenseName" placeholder="e.g., Rent">
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" id="expenseAmount" placeholder="2000">
            </div>
            <div class="form-group">
                <label>Frequency</label>
                <select id="expenseFrequency">
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                </select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="expenseCategory" onchange="ui.toggleCustomExpenseCategory()">
                    <option value="housing">Housing (Rent/Mortgage)</option>
                    <option value="transportation">Transportation</option>
                    <option value="food">Food & Dining</option>
                    <option value="utilities">Utilities</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="insurance">Insurance</option>
                    <option value="debt">Debt Payments</option>
                    <option value="education">Education</option>
                    <option value="childcare">Childcare</option>
                    <option value="shopping">Shopping & Personal</option>
                    <option value="entertainment">Entertainment & Recreation</option>
                    <option value="travel">Travel & Vacation</option>
                    <option value="gifts">Gifts & Donations</option>
                    <option value="savings">Savings & Investments</option>
                    <option value="pets">Pets</option>
                    <option value="subscriptions">Subscriptions & Memberships</option>
                    <option value="other">Other</option>
                    <option value="custom">Custom Category...</option>
                </select>
            </div>
            <div class="form-group" id="customExpenseCategoryGroup" style="display: none;">
                <label>Custom Category Name</label>
                <input type="text" id="customExpenseCategory" placeholder="e.g., Cycling, Hobbies, etc.">
                <small style="color: #64748b; display: block; margin-top: 5px;">Enter a custom category name (will be saved for future use)</small>
            </div>
            <div class="form-group">
                <label>Start Year</label>
                <input type="number" id="expenseStartYear" value="${currentYear}">
            </div>
            <div class="form-group">
                <label>End Year (optional)</label>
                <input type="number" id="expenseEndYear" placeholder="Leave empty for ongoing">
            </div>
            <div class="form-group">
                <label>Annual Growth Rate (%)</label>
                <input type="number" id="expenseGrowth" value="3.0" step="0.1">
            </div>
            <button class="btn btn-primary" id="saveExpenseModalBtn">Add Expense</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener
        const saveBtn = document.getElementById('saveExpenseModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.addExpense());
        }
    }

    toggleCustomExpenseCategory() {
        const select = document.getElementById('expenseCategory');
        const customGroup = document.getElementById('customExpenseCategoryGroup');
        if (select.value === 'custom') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
        }
    }

    addExpense() {
        let category = document.getElementById('expenseCategory').value;

        // If custom category is selected, use the custom input value
        if (category === 'custom') {
            const customCategory = document.getElementById('customExpenseCategory').value.trim();
            if (!customCategory) {
                alert('Please enter a custom category name');
                return;
            }
            // Convert to lowercase with underscores for consistency
            category = customCategory.toLowerCase().replace(/\s+/g, '_');
        }

        this.model.addExpense({
            name: document.getElementById('expenseName').value,
            amount: document.getElementById('expenseAmount').value,
            frequency: document.getElementById('expenseFrequency').value,
            category: category,
            startYear: document.getElementById('expenseStartYear').value,
            endYear: document.getElementById('expenseEndYear').value || null,
            growth: document.getElementById('expenseGrowth').value
        });
        this.closeModal();
        this.updateDashboard();
        this.saveData();
    }

    deleteExpense(id) {
        this.model.removeItem(this.model.expenses, id);
        this.updateDashboard();
        this.saveData();
    }

    editExpense(id) {
        const expense = this.model.expenses.find(e => e.id === id);
        if (!expense) return;

        const currentYear = new Date().getFullYear();
        const modal = this.createModal('Edit Expense', `
            <div class="form-group">
                <label>Expense Name</label>
                <input type="text" id="expenseName" value="${expense.name}" placeholder="e.g., Rent">
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" id="expenseAmount" value="${expense.amount}" placeholder="2000">
            </div>
            <div class="form-group">
                <label>Frequency</label>
                <select id="expenseFrequency">
                    <option value="monthly" ${expense.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="annual" ${expense.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                </select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="expenseCategory" onchange="ui.toggleCustomExpenseCategory()">
                    <option value="housing" ${expense.category === 'housing' ? 'selected' : ''}>Housing (Rent/Mortgage)</option>
                    <option value="transportation" ${expense.category === 'transportation' ? 'selected' : ''}>Transportation</option>
                    <option value="food" ${expense.category === 'food' ? 'selected' : ''}>Food & Dining</option>
                    <option value="utilities" ${expense.category === 'utilities' ? 'selected' : ''}>Utilities</option>
                    <option value="healthcare" ${expense.category === 'healthcare' ? 'selected' : ''}>Healthcare</option>
                    <option value="insurance" ${expense.category === 'insurance' ? 'selected' : ''}>Insurance</option>
                    <option value="debt" ${expense.category === 'debt' ? 'selected' : ''}>Debt Payments</option>
                    <option value="education" ${expense.category === 'education' ? 'selected' : ''}>Education</option>
                    <option value="childcare" ${expense.category === 'childcare' ? 'selected' : ''}>Childcare</option>
                    <option value="shopping" ${expense.category === 'shopping' ? 'selected' : ''}>Shopping & Personal</option>
                    <option value="entertainment" ${expense.category === 'entertainment' ? 'selected' : ''}>Entertainment & Recreation</option>
                    <option value="travel" ${expense.category === 'travel' ? 'selected' : ''}>Travel & Vacation</option>
                    <option value="gifts" ${expense.category === 'gifts' ? 'selected' : ''}>Gifts & Donations</option>
                    <option value="savings" ${expense.category === 'savings' ? 'selected' : ''}>Savings & Investments</option>
                    <option value="pets" ${expense.category === 'pets' ? 'selected' : ''}>Pets</option>
                    <option value="subscriptions" ${expense.category === 'subscriptions' ? 'selected' : ''}>Subscriptions & Memberships</option>
                    <option value="other" ${expense.category === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Start Year</label>
                <input type="number" id="expenseStartYear" value="${expense.startYear}">
            </div>
            <div class="form-group">
                <label>End Year (optional)</label>
                <input type="number" id="expenseEndYear" value="${expense.endYear || ''}" placeholder="Leave empty for ongoing">
            </div>
            <div class="form-group">
                <label>Annual Growth Rate (%)</label>
                <input type="number" id="expenseGrowth" value="${expense.growth}" step="0.1">
            </div>
            <button class="btn btn-primary" id="updateExpenseModalBtn">Update Expense</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener
        const saveBtn = document.getElementById('updateExpenseModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.updateExpense(id));
        }
    }

    updateExpense(id) {
        const expense = this.model.expenses.find(e => e.id === id);
        if (!expense) return;

        expense.name = document.getElementById('expenseName').value;
        expense.amount = parseFloat(document.getElementById('expenseAmount').value);
        expense.frequency = document.getElementById('expenseFrequency').value;
        expense.category = document.getElementById('expenseCategory').value;
        expense.startYear = parseInt(document.getElementById('expenseStartYear').value);
        expense.endYear = parseInt(document.getElementById('expenseEndYear').value) || null;
        expense.growth = parseFloat(document.getElementById('expenseGrowth').value);

        this.closeModal();
        this.updateDashboard();
        this.saveData();
    }

    showMilestoneModal() {
        const currentYear = new Date().getFullYear();
        const modal = this.createModal('Add Milestone', `
            <div class="form-group">
                <label>Milestone Name</label>
                <input type="text" id="milestoneName" placeholder="e.g., Emily's Student Loan Forgiveness">
            </div>

            <div class="form-group">
                <label>Type</label>
                <select id="milestoneType">
                    <option value="retirement">Retirement Expenses (party, relocation, RV, etc.)</option>
                    <option value="home">Home Purchase</option>
                    <option value="inheritance">Inheritance/Windfall</option>
                    <option value="education">Education</option>
                    <option value="travel">Travel</option>
                    <option value="other">Other</option>
                </select>
                <small style="color: #64748b; display: block; margin-top: 5px;">
                    Note: Set your actual retirement year in Settings page (Person A/B). This milestone is for retirement-related expenses.
                </small>
            </div>

            <div class="form-group">
                <label>Year</label>
                <input type="number" id="milestoneYear" value="${currentYear + 5}">
            </div>

            <div style="padding: 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Cash Flow</h4>

                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="milestoneIsPositive" style="margin: 0;">
                        <label for="milestoneIsPositive" style="margin: 0; font-weight: normal;">
                            This is a positive event (money coming TO you)
                        </label>
                    </div>
                    <small style="color: #64748b; display: block; margin-top: 4px; margin-left: 24px;">
                        Check for inheritance, bonus, windfall
                    </small>
                </div>

                <div class="form-group" style="margin-bottom: 12px;">
                    <label>One-time Cash Amount</label>
                    <input type="number" id="milestoneCost" placeholder="0" step="1000">
                    <small style="color: #64748b;">Actual cash received or spent</small>
                </div>

                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="milestoneRecurring" style="margin: 0;">
                        <label for="milestoneRecurring" style="margin: 0; font-weight: normal;">
                            Recurring cash flow after this year
                        </label>
                    </div>
                </div>

                <div id="recurringFieldsGroup" style="display: none;">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Recurring Amount</label>
                        <input type="number" id="milestoneRecurringAmount" placeholder="0" step="1000">
                        <small style="color: #64748b;">Amount for each occurrence</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Repeat Every</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="number" id="milestoneRecurringInterval" placeholder="1" min="1" max="50" value="1" style="width: 80px;">
                            <span style="color: #64748b;">year(s)</span>
                        </div>
                        <small style="color: #64748b;">Examples: 1 = every year, 8 = every 8 years (like buying a car)</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label>Annual Growth Rate (%)</label>
                        <input type="number" id="milestoneRecurringGrowth" placeholder="0" min="0" max="20" step="0.5" value="0" style="width: 100px;">
                        <small style="color: #64748b;">Accounts for inflation/appreciation. Example: 3% means a $40k car today will cost $44k in 3 years</small>
                    </div>
                </div>
            </div>

            <div style="padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #991b1b;">Tax Bomb 💣</h4>

                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="milestoneIsTaxable" style="margin: 0;">
                        <label for="milestoneIsTaxable" style="margin: 0; font-weight: normal;">
                            This creates taxable income (but provides no cash)
                        </label>
                    </div>
                    <small style="color: #64748b; display: block; margin-top: 4px; margin-left: 24px;">
                        Use for student loan forgiveness, imputed income, etc.
                    </small>
                </div>

                <div id="taxableFieldsGroup" style="display: none;">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Taxable Income Amount</label>
                        <input type="number" id="milestoneTaxableAmount" placeholder="0" step="1000">
                        <small style="color: #64748b;">Amount added to taxable income (e.g., $350,000 forgiven debt)</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label>Tax Category</label>
                        <select id="milestoneTaxCategory">
                            <option value="loan_forgiveness">Student Loan Forgiveness (IDR/PAYE/REPAYE)</option>
                            <option value="bonus">Bonus or Windfall</option>
                            <option value="inheritance">Taxable Inheritance</option>
                            <option value="other">Other Taxable Event</option>
                        </select>
                    </div>
                </div>
            </div>

            <button class="btn btn-primary" id="saveMilestoneModalBtn">Add Milestone</button>
        `);
        document.body.appendChild(modal);

        // Toggle recurring fields visibility
        const recurringCheckbox = document.getElementById('milestoneRecurring');
        const recurringFieldsGroup = document.getElementById('recurringFieldsGroup');
        if (recurringCheckbox && recurringFieldsGroup) {
            recurringCheckbox.addEventListener('change', (e) => {
                recurringFieldsGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Toggle tax fields visibility
        const isTaxableCheckbox = document.getElementById('milestoneIsTaxable');
        const taxableFieldsGroup = document.getElementById('taxableFieldsGroup');
        if (isTaxableCheckbox && taxableFieldsGroup) {
            isTaxableCheckbox.addEventListener('change', (e) => {
                taxableFieldsGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Attach event listener
        const saveBtn = document.getElementById('saveMilestoneModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.addMilestone());
        }
    }

    addMilestone() {
        const isTaxable = document.getElementById('milestoneIsTaxable').checked;
        const isRecurring = document.getElementById('milestoneRecurring').checked;
        this.model.addMilestone({
            name: document.getElementById('milestoneName').value,
            type: document.getElementById('milestoneType').value,
            year: document.getElementById('milestoneYear').value,
            cost: document.getElementById('milestoneCost').value,
            isPositive: document.getElementById('milestoneIsPositive').checked,
            recurring: isRecurring,
            recurringAmount: document.getElementById('milestoneRecurringAmount').value,
            recurringInterval: isRecurring ? (document.getElementById('milestoneRecurringInterval').value || 1) : 1,
            recurringGrowth: isRecurring ? (document.getElementById('milestoneRecurringGrowth').value || 0) : 0,
            isTaxable: isTaxable,
            taxableAmount: isTaxable ? parseFloat(document.getElementById('milestoneTaxableAmount').value) || 0 : 0,
            taxCategory: isTaxable ? document.getElementById('milestoneTaxCategory').value : null
        });
        this.closeModal();
        this.updateDashboard();
        this.saveData();
    }

    deleteMilestone(id) {
        this.model.removeItem(this.model.milestones, id);
        this.updateDashboard();
        this.saveData();
    }

    editMilestone(id) {
        const milestone = this.model.milestones.find(m => m.id === id);
        if (!milestone) return;

        const currentYear = new Date().getFullYear();
        const modal = this.createModal('Edit Milestone', `
            <div class="form-group">
                <label>Milestone Name</label>
                <input type="text" id="milestoneName" value="${milestone.name}" placeholder="e.g., Buy First Home">
            </div>

            <div class="form-group">
                <label>Type</label>
                <select id="milestoneType">
                    <option value="retirement" ${milestone.type === 'retirement' ? 'selected' : ''}>Retirement Expenses (party, relocation, RV, etc.)</option>
                    <option value="home" ${milestone.type === 'home' ? 'selected' : ''}>Home Purchase</option>
                    <option value="education" ${milestone.type === 'education' ? 'selected' : ''}>Education</option>
                    <option value="travel" ${milestone.type === 'travel' ? 'selected' : ''}>Travel</option>
                    <option value="other" ${milestone.type === 'other' ? 'selected' : ''}>Other</option>
                </select>
                <small style="color: #64748b; display: block; margin-top: 5px;">
                    Note: Set your actual retirement year in Settings page (Person A/B). This milestone is for retirement-related expenses.
                </small>
            </div>

            <div class="form-group">
                <label>Year</label>
                <input type="number" id="milestoneYear" value="${milestone.year}" min="${currentYear}">
            </div>

            <div style="padding: 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Cash Flow</h4>

                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="milestonePositive" ${milestone.isPositive ? 'checked' : ''} style="margin: 0;">
                        <label for="milestonePositive" style="margin: 0; font-weight: normal;">
                            This is a positive event (money coming TO you)
                        </label>
                    </div>
                    <small style="color: #64748b; display: block; margin-top: 4px; margin-left: 24px;">
                        Check for inheritance, bonus, windfall
                    </small>
                </div>

                <div class="form-group" style="margin-bottom: 12px;">
                    <label>One-time Cash Amount</label>
                    <input type="number" id="milestoneCost" value="${milestone.cost}" step="1000">
                    <small style="color: #64748b;">Actual cash received or spent</small>
                </div>

                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="milestoneRecurring" ${milestone.recurring ? 'checked' : ''} style="margin: 0;">
                        <label for="milestoneRecurring" style="margin: 0; font-weight: normal;">
                            Recurring cash flow after this year
                        </label>
                    </div>
                </div>

                <div id="recurringFieldsGroup" style="display: ${milestone.recurring ? 'block' : 'none'};">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Recurring Amount</label>
                        <input type="number" id="milestoneRecurringAmount" value="${milestone.recurringAmount || 0}" step="1000">
                        <small style="color: #64748b;">Amount for each occurrence</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Repeat Every</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="number" id="milestoneRecurringInterval" value="${milestone.recurringInterval || 1}" min="1" max="50" style="width: 80px;">
                            <span style="color: #64748b;">year(s)</span>
                        </div>
                        <small style="color: #64748b;">Examples: 1 = every year, 8 = every 8 years (like buying a car)</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label>Annual Growth Rate (%)</label>
                        <input type="number" id="milestoneRecurringGrowth" value="${milestone.recurringGrowth || 0}" min="0" max="20" step="0.5" style="width: 100px;">
                        <small style="color: #64748b;">Accounts for inflation/appreciation. Example: 3% means a $40k car today will cost $44k in 3 years</small>
                    </div>
                </div>
            </div>

            <div style="padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #991b1b;">Tax Bomb 💣</h4>

                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="milestoneIsTaxable" ${milestone.isTaxable ? 'checked' : ''} style="margin: 0;">
                        <label for="milestoneIsTaxable" style="margin: 0; font-weight: normal;">
                            This creates taxable income (but provides no cash)
                        </label>
                    </div>
                    <small style="color: #64748b; display: block; margin-top: 4px; margin-left: 24px;">
                        Use for student loan forgiveness, imputed income, etc.
                    </small>
                </div>

                <div id="taxableFieldsGroup" style="display: ${milestone.isTaxable ? 'block' : 'none'};">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Taxable Income Amount</label>
                        <input type="number" id="milestoneTaxableAmount" value="${milestone.taxableAmount || 0}" placeholder="0" step="1000">
                        <small style="color: #64748b;">Amount added to taxable income (e.g., $350,000 forgiven debt)</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label>Tax Category</label>
                        <select id="milestoneTaxCategory">
                            <option value="loan_forgiveness" ${milestone.taxCategory === 'loan_forgiveness' ? 'selected' : ''}>Student Loan Forgiveness (IDR/PAYE/REPAYE)</option>
                            <option value="bonus" ${milestone.taxCategory === 'bonus' ? 'selected' : ''}>Bonus or Windfall</option>
                            <option value="inheritance" ${milestone.taxCategory === 'inheritance' ? 'selected' : ''}>Taxable Inheritance</option>
                            <option value="other" ${milestone.taxCategory === 'other' ? 'selected' : ''}>Other Taxable Event</option>
                        </select>
                    </div>
                </div>
            </div>

            <button class="btn btn-primary" id="updateMilestoneModalBtn">Update Milestone</button>
        `);
        document.body.appendChild(modal);

        // Toggle recurring fields visibility
        const recurringCheckbox = document.getElementById('milestoneRecurring');
        const recurringFieldsGroup = document.getElementById('recurringFieldsGroup');
        if (recurringCheckbox && recurringFieldsGroup) {
            recurringCheckbox.addEventListener('change', (e) => {
                recurringFieldsGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Toggle tax fields visibility
        const isTaxableCheckbox = document.getElementById('milestoneIsTaxable');
        const taxableFieldsGroup = document.getElementById('taxableFieldsGroup');
        if (isTaxableCheckbox && taxableFieldsGroup) {
            isTaxableCheckbox.addEventListener('change', (e) => {
                taxableFieldsGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Attach event listener
        const saveBtn = document.getElementById('updateMilestoneModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.updateMilestone(id));
        }
    }

    updateMilestone(id) {
        const milestone = this.model.milestones.find(m => m.id === id);
        if (!milestone) return;

        const isTaxable = document.getElementById('milestoneIsTaxable').checked;
        const isRecurring = document.getElementById('milestoneRecurring').checked;
        milestone.name = document.getElementById('milestoneName').value;
        milestone.type = document.getElementById('milestoneType').value;
        milestone.year = parseInt(document.getElementById('milestoneYear').value, 10);
        milestone.cost = parseFloat(document.getElementById('milestoneCost').value);
        milestone.isPositive = document.getElementById('milestonePositive').checked;
        milestone.recurring = isRecurring;
        milestone.recurringAmount = parseFloat(document.getElementById('milestoneRecurringAmount').value) || 0;
        milestone.recurringInterval = isRecurring ? (parseInt(document.getElementById('milestoneRecurringInterval').value, 10) || 1) : 1;
        milestone.recurringGrowth = isRecurring ? (parseFloat(document.getElementById('milestoneRecurringGrowth').value) || 0) : 0;
        milestone.isTaxable = isTaxable;
        milestone.taxableAmount = isTaxable ? parseFloat(document.getElementById('milestoneTaxableAmount').value) || 0 : 0;
        milestone.taxCategory = isTaxable ? document.getElementById('milestoneTaxCategory').value : null;

        this.closeModal();
        this.updateDashboard();
        this.saveData();
    }

    showRentalPeriodModal(rental = null) {
        const isEdit = rental !== null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                <span class="close-modal">&times;</span>
                <h2>${isEdit ? 'Edit' : 'Add'} Rental Period</h2>

                <div class="form-group">
                    <label>Name / Description</label>
                    <input type="text" id="rentalName" value="${rental?.name || 'Rental'}" placeholder="e.g., Downtown Apartment">
                </div>

                <div class="form-group">
                    <label>Monthly Rent ($)</label>
                    <input type="number" id="rentalMonthlyRent" value="${rental?.monthlyRent || 0}" step="100">
                </div>

                <div class="form-group">
                    <label>Start Year</label>
                    <input type="number" id="rentalStartYear" value="${rental?.startYear || this.model.settings.planStartYear}">
                </div>

                <div class="form-group">
                    <label>End Year (leave empty for ongoing)</label>
                    <input type="number" id="rentalEndYear" value="${rental?.endYear || ''}" placeholder="Optional">
                    <small>Leave blank if you're still renting or don't know when it will end</small>
                </div>

                <div class="form-group">
                    <label>Annual Rent Increase (%)</label>
                    <input type="number" id="rentalIncrease" value="${rental?.annualIncrease || 3.0}" step="0.1">
                    <small>Typical: 3-5% per year</small>
                </div>

                <div class="form-group">
                    <label>Security Deposit ($)</label>
                    <input type="number" id="rentalSecurityDeposit" value="${rental?.securityDeposit || 0}">
                    <small>One-time payment when you move in (year ${rental?.startYear || this.model.settings.planStartYear})</small>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" id="cancelRentalBtn">Cancel</button>
                    <button class="btn btn-primary" id="saveRentalBtn">${isEdit ? 'Update' : 'Add'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        setTimeout(() => {
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }

            const cancelBtn = document.getElementById('cancelRentalBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.closeModal());
            }

            const saveBtn = document.getElementById('saveRentalBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    if (isEdit) this.updateRentalPeriod(rental.id);
                    else this.addRentalPeriod();
                }, { once: true });
            }
        }, 0);
    }

    addRentalPeriod() {
        const endYearValue = document.getElementById('rentalEndYear').value;

        const rental = {
            name: document.getElementById('rentalName').value,
            monthlyRent: parseFloat(document.getElementById('rentalMonthlyRent').value) || 0,
            startYear: parseInt(document.getElementById('rentalStartYear').value),
            endYear: endYearValue ? parseInt(endYearValue) : null,
            annualIncrease: parseFloat(document.getElementById('rentalIncrease').value) || 3.0,
            securityDeposit: parseFloat(document.getElementById('rentalSecurityDeposit').value) || 0
        };

        console.log('Adding rental period to current working plan:', rental);
        this.model.addRentalPeriod(rental);
        console.log('Total rental periods after add:', this.model.housing.rentalPeriods.length);

        this.closeModal();
        this.updateRentalPeriodsList();
        this.updateDashboard();
        this.saveData();
    }

    updateRentalPeriod(id) {
        const rental = this.model.housing.rentalPeriods.find(r => r.id === id);
        if (!rental) return;

        const endYearValue = document.getElementById('rentalEndYear').value;

        rental.name = document.getElementById('rentalName').value;
        rental.monthlyRent = parseFloat(document.getElementById('rentalMonthlyRent').value) || 0;
        rental.startYear = parseInt(document.getElementById('rentalStartYear').value);
        rental.endYear = endYearValue ? parseInt(endYearValue) : null;
        rental.annualIncrease = parseFloat(document.getElementById('rentalIncrease').value) || 3.0;
        rental.securityDeposit = parseFloat(document.getElementById('rentalSecurityDeposit').value) || 0;

        this.closeModal();
        this.updateRentalPeriodsList();
        this.updateDashboard();
        this.saveData();
    }

    deleteRentalPeriod(id) {
        if (confirm('Are you sure you want to delete this rental period?')) {
            this.model.housing.rentalPeriods = this.model.housing.rentalPeriods.filter(r => r.id !== id);
            this.updateRentalPeriodsList();
            this.updateDashboard();
            this.saveData();
        }
    }

    updateRentalPeriodsList() {
        const container = document.getElementById('rentalPeriodsList');
        if (!container) return;

        const rentalPeriods = this.model.housing.rentalPeriods;

        if (rentalPeriods.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">No rental periods added yet</p>';
            return;
        }

        container.innerHTML = rentalPeriods
            .sort((a, b) => a.startYear - b.startYear)
            .map(rental => {
                const endYearText = rental.endYear ? rental.endYear : 'Ongoing';
                const duration = rental.endYear ? `${rental.endYear - rental.startYear + 1} years` : 'Ongoing';

                return `
                    <div class="list-item" style="margin-bottom: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 8px 0;">${rental.name}</h4>
                                <p style="margin: 4px 0; color: #666;">
                                    <strong>$${rental.monthlyRent.toLocaleString()}/mo</strong>
                                    (${rental.startYear} - ${endYearText})
                                    <span style="color: #999;">• ${duration}</span>
                                </p>
                                <p style="margin: 4px 0; font-size: 14px; color: #888;">
                                    Annual increase: ${rental.annualIncrease}%
                                    ${rental.securityDeposit > 0 ? ` • Security deposit: $${rental.securityDeposit.toLocaleString()}` : ''}
                                </p>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary btn-sm" onclick="ui.showRentalPeriodModal(${JSON.stringify(rental).replace(/"/g, '&quot;')})">Edit</button>
                                <button class="btn btn-danger btn-sm" onclick="ui.deleteRentalPeriod(${rental.id})">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    addProperty() {
        const sellYearValue = document.getElementById('sellYear').value;

        const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
        const downPayment = parseFloat(document.getElementById('downPayment').value) || 0;

        console.log(`Adding property: purchasePrice=${purchasePrice}, downPayment=${downPayment}, loanAmount=${purchasePrice - downPayment}`);

        const property = {
            name: document.getElementById('propertyName').value,
            purchaseYear: parseInt(document.getElementById('purchaseYear').value),
            purchasePrice: purchasePrice,
            downPayment: downPayment,
            closingCosts: parseFloat(document.getElementById('closingCosts').value) || 0,
            interestRate: parseFloat(document.getElementById('interestRate').value),
            loanTermYears: parseInt(document.getElementById('loanTermYears').value),
            extraPaymentMonthly: parseFloat(document.getElementById('extraPaymentMonthly').value) || 0,
            propertyTaxRate: parseFloat(document.getElementById('propertyTaxRate').value),
            insuranceAnnual: parseFloat(document.getElementById('insuranceAnnual').value),
            hoaMonthly: parseFloat(document.getElementById('hoaMonthly').value) || 0,
            maintenanceRate: parseFloat(document.getElementById('maintenanceRate').value),
            appreciationRate: parseFloat(document.getElementById('appreciationRate').value),
            sellYear: sellYearValue ? parseInt(sellYearValue) : null,
            sellingCosts: parseFloat(document.getElementById('sellingCosts').value) || 8
        };

        this.model.addOwnedProperty(property);
        this.closeModal();
        this.updatePropertiesList();
        this.updateDashboard();
        this.saveData();
    }

    updateProperty(id) {
        const property = this.model.housing.ownedProperties.find(p => p.id === id);
        if (!property) return;

        const sellYearValue = document.getElementById('sellYear').value;
        property.name = document.getElementById('propertyName').value;
        property.purchaseYear = parseInt(document.getElementById('purchaseYear').value);
        property.purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
        property.downPayment = parseFloat(document.getElementById('downPayment').value);
        property.closingCosts = parseFloat(document.getElementById('closingCosts').value) || 0;
        property.interestRate = parseFloat(document.getElementById('interestRate').value);
        property.loanTermYears = parseInt(document.getElementById('loanTermYears').value);
        property.extraPaymentMonthly = parseFloat(document.getElementById('extraPaymentMonthly').value) || 0;
        property.propertyTaxRate = parseFloat(document.getElementById('propertyTaxRate').value);
        property.insuranceAnnual = parseFloat(document.getElementById('insuranceAnnual').value);
        property.hoaMonthly = parseFloat(document.getElementById('hoaMonthly').value) || 0;
        property.maintenanceRate = parseFloat(document.getElementById('maintenanceRate').value);
        property.appreciationRate = parseFloat(document.getElementById('appreciationRate').value);
        property.sellYear = sellYearValue ? parseInt(sellYearValue) : null;
        property.sellingCosts = parseFloat(document.getElementById('sellingCosts').value) || 8;

        // Recalculate mortgage details
        const loanAmount = property.purchasePrice - property.downPayment;
        const monthlyInterestRate = property.interestRate / 100 / 12;
        const numPayments = property.loanTermYears * 12;
        if (loanAmount > 0 && property.interestRate > 0) {
            property.monthlyPayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numPayments)) /
                                    (Math.pow(1 + monthlyInterestRate, numPayments) - 1);
        } else {
            property.monthlyPayment = 0;
        }
        property.loanAmount = loanAmount;

        this.closeModal();
        this.updatePropertiesList();
        this.updateDashboard();
        this.saveData();
    }

    deleteProperty(id) {
        if (confirm('Are you sure you want to delete this property?')) {
            this.model.removeItem(this.model.housing.ownedProperties, id);
            this.updatePropertiesList();
            this.updateDashboard();
            this.saveData();
        }
    }

    updatePropertiesList() {
        const container = document.getElementById('propertiesList');
        if (!container) return;

        if (this.model.housing.ownedProperties.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">No owned properties added yet</p>';
            return;
        }

        container.innerHTML = this.model.housing.ownedProperties
            .sort((a, b) => a.purchaseYear - b.purchaseYear)
            .map(property => {
                const sellYearText = property.sellYear ? property.sellYear : 'Ongoing';
                const duration = property.sellYear ? `${property.sellYear - property.purchaseYear} years` : 'Ongoing';

                return `
                    <div class="list-item" style="margin-bottom: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 8px 0;">${property.name}</h4>
                                <p style="margin: 4px 0; color: #666;">
                                    <strong>$${property.purchasePrice.toLocaleString()}</strong> purchase
                                    (${property.purchaseYear} - ${sellYearText})
                                    <span style="color: #999;">• ${duration}</span>
                                </p>
                                <p style="margin: 4px 0; font-size: 14px; color: #888;">
                                    Down: $${property.downPayment.toLocaleString()}
                                    • Loan: $${property.loanAmount.toLocaleString()} @ ${property.interestRate}%
                                    ${property.monthlyPayment ? ` • $${Math.round(property.monthlyPayment).toLocaleString()}/mo` : ''}
                                </p>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary btn-sm" onclick="ui.showPropertyModal(${JSON.stringify(property).replace(/"/g, '&quot;')})">Edit</button>
                                <button class="btn btn-danger btn-sm" onclick="ui.deleteProperty(${property.id})">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    addCreditCard() {
        const card = {
            name: document.getElementById('cardName').value,
            balance: parseFloat(document.getElementById('cardBalance').value),
            apr: parseFloat(document.getElementById('cardAPR').value),
            minimumPaymentPercent: parseFloat(document.getElementById('minPaymentPercent').value),
            extraPayment: parseFloat(document.getElementById('extraPayment').value) || 0
        };

        this.model.addCreditCard(card);
        this.closeModal();
        this.updateCreditCardsList();
        this.updateDashboard();
        this.saveData();
    }

    updateCreditCard(id) {
        const card = this.model.debts.creditCards.find(c => c.id === id);
        if (!card) return;

        card.name = document.getElementById('cardName').value;
        card.balance = parseFloat(document.getElementById('cardBalance').value);
        card.apr = parseFloat(document.getElementById('cardAPR').value);
        card.minimumPaymentPercent = parseFloat(document.getElementById('minPaymentPercent').value);
        card.extraPayment = parseFloat(document.getElementById('extraPayment').value) || 0;

        this.closeModal();
        this.updateCreditCardsList();
        this.updateDashboard();
        this.saveData();
    }

    deleteCreditCard(id) {
        if (confirm('Are you sure you want to delete this credit card?')) {
            this.model.removeItem(this.model.debts.creditCards, id);
            this.updateCreditCardsList();
            this.updateDashboard();
            this.saveData();
        }
    }

    updateCreditCardsList() {
        const container = document.getElementById('creditCardsList');
        if (!container) return;

        container.innerHTML = '<div class="item-list">' +
            this.model.debts.creditCards.map(card => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>${card.name}</h3>
                        <p>Balance: $${card.balance.toLocaleString()} @ ${card.apr}% APR</p>
                        <p>Min Payment: ${card.minimumPaymentPercent}% + Extra: $${card.extraPayment}/mo</p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-secondary" onclick="ui.showCreditCardModal(${JSON.stringify(card).replace(/"/g, '&quot;')})">Edit</button>
                        <button class="btn btn-danger" onclick="ui.deleteCreditCard(${card.id})">Delete</button>
                    </div>
                </div>
            `).join('') +
        '</div>';
    }

    addLoan() {
        const payoffYear = document.getElementById('loanPayoffYear').value;
        const forgiveYear = document.getElementById('loanForgiveYear').value;
        const forgivenessAmount = document.getElementById('loanForgivenessAmount').value;

        const loan = {
            name: document.getElementById('loanName').value,
            type: document.getElementById('loanType').value,
            balance: parseFloat(document.getElementById('loanBalance').value),
            interestRate: parseFloat(document.getElementById('loanRate').value),
            monthlyPayment: parseFloat(document.getElementById('loanPayment').value),
            startYear: parseInt(document.getElementById('loanStartYear').value),
            termYears: parseInt(document.getElementById('loanTerm').value),
            payoffYear: payoffYear ? parseInt(payoffYear) : null,
            forgiveYear: forgiveYear ? parseInt(forgiveYear) : null,
            forgivenessIsTaxable: document.getElementById('loanForgivenessIsTaxable').checked,
            forgivenessAmount: forgivenessAmount ? parseFloat(forgivenessAmount) : null
        };

        this.model.addLoan(loan);
        this.closeModal();
        this.updateLoansList();
        this.updateDashboard();
        this.saveData();
    }

    updateLoan(id) {
        const loan = this.model.debts.loans.find(l => l.id === id);
        if (!loan) return;

        const payoffYear = document.getElementById('loanPayoffYear').value;
        const forgiveYear = document.getElementById('loanForgiveYear').value;
        const forgivenessAmount = document.getElementById('loanForgivenessAmount').value;

        loan.name = document.getElementById('loanName').value;
        loan.type = document.getElementById('loanType').value;
        loan.balance = parseFloat(document.getElementById('loanBalance').value);
        loan.interestRate = parseFloat(document.getElementById('loanRate').value);
        loan.monthlyPayment = parseFloat(document.getElementById('loanPayment').value);
        loan.startYear = parseInt(document.getElementById('loanStartYear').value);
        loan.termYears = parseInt(document.getElementById('loanTerm').value);
        loan.payoffYear = payoffYear ? parseInt(payoffYear) : null;
        loan.forgiveYear = forgiveYear ? parseInt(forgiveYear) : null;
        loan.forgivenessIsTaxable = document.getElementById('loanForgivenessIsTaxable').checked;
        loan.forgivenessAmount = forgivenessAmount ? parseFloat(forgivenessAmount) : null;

        this.closeModal();
        this.updateLoansList();
        this.updateDashboard();
        this.saveData();
    }

    deleteLoan(id) {
        if (confirm('Are you sure you want to delete this loan?')) {
            this.model.removeItem(this.model.debts.loans, id);
            this.updateLoansList();
            this.updateDashboard();
            this.saveData();
        }
    }

    updateLoansList() {
        const container = document.getElementById('loansList');
        if (!container) return;

        container.innerHTML = '<div class="item-list">' +
            this.model.debts.loans.map(loan => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>${loan.name}</h3>
                        <p>Type: ${loan.type.charAt(0).toUpperCase() + loan.type.slice(1)}</p>
                        <p>Balance: $${loan.balance.toLocaleString()} @ ${loan.interestRate}%</p>
                        <p>Payment: $${loan.monthlyPayment.toLocaleString()}/mo (${loan.termYears} year term)</p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-secondary" onclick="ui.showLoanModal(${JSON.stringify(loan).replace(/"/g, '&quot;')})">Edit</button>
                        <button class="btn btn-danger" onclick="ui.deleteLoan(${loan.id})">Delete</button>
                    </div>
                </div>
            `).join('') +
        '</div>';
    }

    showGlidePathModal() {
        const currentYear = new Date().getFullYear();
        const modal = this.createModal('Add Investment Period', `
            <div class="form-group">
                <label>Starting Year</label>
                <input type="number" id="glidePathYear" value="${currentYear}" min="${currentYear}">
                <small style="color: #64748b; display: block; margin-top: 5px;">When does this allocation strategy begin?</small>
            </div>
            <div class="form-group">
                <label>Expected Return (%)</label>
                <input type="number" id="glidePathReturn" value="7" step="0.1">
                <small style="color: #64748b; display: block; margin-top: 5px;">Average annual return (e.g., 7-9% for aggressive, 4-6% for moderate, 2-4% for conservative)</small>
            </div>
            <div class="form-group">
                <label>Volatility / Std Deviation (%)</label>
                <input type="number" id="glidePathVolatility" value="15" step="0.1">
                <small style="color: #64748b; display: block; margin-top: 5px;">Risk level (e.g., 15-20% for stocks, 5-10% for bonds, 3-5% for cash)</small>
            </div>
            <button class="btn btn-primary" id="saveGlidePathModalBtn">Add Period</button>
        `);
        document.body.appendChild(modal);

        // Attach event listener
        const saveBtn = document.getElementById('saveGlidePathModalBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.addGlidePathPeriod());
        }
    }

    addGlidePathPeriod() {
        const newPeriod = {
            startYear: parseInt(document.getElementById('glidePathYear').value),
            expectedReturn: parseFloat(document.getElementById('glidePathReturn').value),
            volatility: parseFloat(document.getElementById('glidePathVolatility').value)
        };

        // Remove any existing period with the same start year
        this.model.investmentGlidePath = this.model.investmentGlidePath.filter(
            p => p.startYear !== newPeriod.startYear
        );

        // Add new period and sort by year
        this.model.investmentGlidePath.push(newPeriod);
        this.model.investmentGlidePath.sort((a, b) => a.startYear - b.startYear);

        this.closeModal();
        this.updateGlidePathList();
        this.saveData();
    }

    deleteGlidePathPeriod(startYear) {
        this.model.investmentGlidePath = this.model.investmentGlidePath.filter(
            p => p.startYear !== startYear
        );
        this.updateGlidePathList();
        this.saveData();
    }

    updateGlidePathList() {
        const container = document.getElementById('glidePathList');
        if (!container) return;

        if (this.model.investmentGlidePath.length === 0) {
            container.innerHTML = '<p style="color: #64748b; margin-top: 15px;">No glide path defined. Using default values from simulation settings.</p>';
            return;
        }

        container.innerHTML = '<div class="item-list" style="margin-top: 15px;">' +
            this.model.investmentGlidePath.map((period, idx) => {
                const nextPeriod = this.model.investmentGlidePath[idx + 1];
                const endYearText = nextPeriod ? ` to ${nextPeriod.startYear - 1}` : '+';
                return `
                <div class="list-item">
                    <div class="list-item-info">
                        <h3>Year ${period.startYear}${endYearText}</h3>
                        <p>Expected Return: ${period.expectedReturn}% | Volatility: ${period.volatility}%</p>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-danger" onclick="ui.deleteGlidePathPeriod(${period.startYear})">Delete</button>
                    </div>
                </div>
                `;
            }).join('') +
        '</div>';
    }

    runMonteCarlo() {
        const numSims = parseInt(document.getElementById('numSimulations').value);

        // Use glide path if defined, otherwise use default values
        let expectedReturn = 7;
        let volatility = 15;

        if (this.model.investmentGlidePath.length > 0) {
            // Use the first period's values as defaults (they'll be overridden by glide path in simulation)
            expectedReturn = this.model.investmentGlidePath[0].expectedReturn;
            volatility = this.model.investmentGlidePath[0].volatility;
        }

        console.log('Running Monte Carlo with:', { numSims, expectedReturn, volatility });
        console.log('Glide path:', JSON.stringify(this.model.investmentGlidePath));

        const results = this.simulator.runSimulation(numSims, expectedReturn, volatility, 40);

        console.log('Monte Carlo final year results:');
        console.log('  Median:', results[results.length - 1].median);
        console.log('  P10:', results[results.length - 1].p10);
        console.log('  P75:', results[results.length - 1].p75);

        // Also run a single deterministic projection for comparison
        const detProjection = this.projectionEngine.projectNetWorth(40);
        console.log('Deterministic projection final year:', detProjection[detProjection.length - 1].netWorth);

        // Create simulation chart
        const ctx = document.getElementById('simulationChart').getContext('2d');
        if (this.charts.simulation) {
            this.charts.simulation.destroy();
        }

        // Calculate y-axis range based on liquid net worth (excluding home)
        const allLiquidValues = results.flatMap(r => [r.p10ExcludingHome, r.medianExcludingHome, r.p75ExcludingHome]);
        const minLiquid = Math.min(...allLiquidValues);
        const maxLiquid = Math.max(...allLiquidValues);
        const liquidRange = maxLiquid - minLiquid;
        const yMin = Math.floor((minLiquid - liquidRange * 0.1) / 100000) * 100000; // Round down to nearest 100k
        const yMax = Math.ceil((maxLiquid + liquidRange * 0.1) / 100000) * 100000; // Round up to nearest 100k

        this.charts.simulation = new Chart(ctx, {
            type: 'line',
            data: {
                labels: results.map(r => r.year),
                datasets: [
                    {
                        label: '75th Percentile (Liquid)',
                        data: results.map(r => r.p75ExcludingHome),
                        borderColor: '#10b981',
                        backgroundColor: 'transparent',
                        borderWidth: 3
                    },
                    {
                        label: 'Median (Liquid)',
                        data: results.map(r => r.medianExcludingHome),
                        borderColor: '#2563eb',
                        backgroundColor: 'transparent',
                        borderWidth: 3
                    },
                    {
                        label: '10th Percentile (Liquid)',
                        data: results.map(r => r.p10ExcludingHome),
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 3
                    },
                    {
                        label: 'Total Net Worth (Median, may be off-chart)',
                        data: results.map(r => r.median),
                        borderColor: '#9ca3af',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true
                    },
                    title: {
                        display: true,
                        text: 'Liquid Net Worth (Investment Accounts Only - Excluding Primary Residence)',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        min: yMin,
                        max: yMax,
                        ticks: {
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                }
            }
        });

        // Show statistics
        const finalYear = results[results.length - 1];
        document.getElementById('simulationStats').innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Success Rate (Total)</div>
                <div class="stat-value">${finalYear.successRate.toFixed(1)}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Success Rate (Liquid Only)</div>
                <div class="stat-value">${finalYear.successRateExcludingHome.toFixed(1)}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Median Final Net Worth</div>
                <div class="stat-value">$${finalYear.median.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Median (Excluding Home)</div>
                <div class="stat-value">$${finalYear.medianExcludingHome.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">75th Percentile</div>
                <div class="stat-value">$${finalYear.p75.toLocaleString()}</div>
            </div>
        `;
    }

    runStressTest(scenarioName) {
        // Get the crash year from the UI
        const timingRadio = document.querySelector('input[name="stressTestTiming"]:checked');
        const crashYearOffset = timingRadio && timingRadio.value === 'custom'
            ? parseInt(document.getElementById('stressTestYear').value) || 0
            : 0;

        // Define historical crash scenarios
        const scenarios = {
            '2008': {
                name: '2008 Financial Crisis',
                description: '-37% in Year 1, slow recovery over 3 years',
                returns: [-37, -5, 26, 15, 7, 7, 7] // 2008-2014 approximate
            },
            '2000': {
                name: '2000 Dot-com Crash',
                description: '-9%, -12%, -22% over 3 years, then recovery',
                returns: [-9, -12, -22, 28, 10, 4, 15, 5] // 2000-2007
            },
            '2020': {
                name: '2020 COVID Crash',
                description: '-34% crash, rapid recovery',
                returns: [-34, 18, 26, 7, 7] // 2020-2024
            },
            'stagflation': {
                name: '1970s Stagflation',
                description: 'Persistent low returns, high inflation',
                returns: [-15, 24, -26, 37, -7, 23, -7, 6, 18, -14] // 1973-1982
            }
        };

        const scenario = scenarios[scenarioName];
        if (!scenario) return;

        // Save original glide path
        const originalGlidePath = JSON.parse(JSON.stringify(this.model.investmentGlidePath));

        // Create stress test glide path
        const currentYear = this.model.settings.planStartYear;
        const stressGlidePath = [];

        // Build the glide path with crash inserted at the specified year
        for (let i = 0; i <= 40; i++) {
            const targetYear = currentYear + i;

            // Check if we're in the crash window
            const crashIndex = i - crashYearOffset;
            const inCrashWindow = crashIndex >= 0 && crashIndex < scenario.returns.length;

            if (inCrashWindow) {
                // Use crash return for this year
                stressGlidePath.push({
                    startYear: targetYear,
                    expectedReturn: scenario.returns[crashIndex],
                    volatility: 0 // No randomness for stress test
                });
            } else {
                // Use normal glide path return for this year
                let glidePath = originalGlidePath.find(gp => gp.startYear <= targetYear);
                if (!glidePath && originalGlidePath.length > 0) {
                    glidePath = originalGlidePath[originalGlidePath.length - 1];
                }

                stressGlidePath.push({
                    startYear: targetYear,
                    expectedReturn: glidePath?.expectedReturn || 7,
                    volatility: 0
                });
            }
        }

        // Temporarily replace glide path
        this.model.investmentGlidePath = stressGlidePath;

        // Run projection with stress scenario
        const stressProjection = this.projectionEngine.projectNetWorth(40);

        // Restore original glide path
        this.model.investmentGlidePath = originalGlidePath;

        // Run normal projection for comparison
        const normalProjection = this.projectionEngine.projectNetWorth(40);

        // Show results
        document.getElementById('stressTestResults').style.display = 'block';

        const ctx = document.getElementById('stressTestChart');
        if (!ctx) return;

        if (this.charts.stressTest) {
            this.charts.stressTest.destroy();
        }

        // Calculate y-axis range based on liquid net worth (excluding home)
        const normalLiquid = normalProjection.map(p => p.netWorth - (p.homeEquity || 0));
        const stressLiquid = stressProjection.map(p => p.netWorth - (p.homeEquity || 0));
        const allLiquidValues = [...normalLiquid, ...stressLiquid];
        const minLiquid = Math.min(...allLiquidValues);
        const maxLiquid = Math.max(...allLiquidValues);
        const liquidRange = maxLiquid - minLiquid;
        const yMin = Math.floor((minLiquid - liquidRange * 0.1) / 100000) * 100000;
        const yMax = Math.ceil((maxLiquid + liquidRange * 0.1) / 100000) * 100000;

        this.charts.stressTest = new Chart(ctx, {
            type: 'line',
            data: {
                labels: stressProjection.map(p => p.year),
                datasets: [
                    {
                        label: 'Normal Scenario (Liquid)',
                        data: normalLiquid,
                        borderColor: '#10b981',
                        backgroundColor: 'transparent',
                        borderWidth: 3
                    },
                    {
                        label: `${scenario.name} (Liquid)`,
                        data: stressLiquid,
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 3
                    },
                    {
                        label: 'Normal Total Net Worth (may be off-chart)',
                        data: normalProjection.map(p => p.netWorth),
                        borderColor: '#9ca3af',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Stress Test: ${scenario.name} - Liquid Net Worth (Excluding Home)`,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        min: yMin,
                        max: yMax,
                        ticks: {
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                }
            }
        });

        // Calculate impact (using liquid net worth for comparison)
        const normalFinalProjection = normalProjection[normalProjection.length - 1];
        const stressFinalProjection = stressProjection[stressProjection.length - 1];

        const normalFinal = normalFinalProjection.netWorth;
        const stressFinal = stressFinalProjection.netWorth;

        const normalFinalLiquid = normalFinal - (normalFinalProjection.homeEquity || 0);
        const stressFinalLiquid = stressFinal - (stressFinalProjection.homeEquity || 0);

        const impact = ((stressFinal - normalFinal) / normalFinal * 100).toFixed(1);
        const impactLiquid = ((stressFinalLiquid - normalFinalLiquid) / normalFinalLiquid * 100).toFixed(1);
        const survives = stressProjection.every(p => p.netWorth > 0);

        document.getElementById('stressTestStats').innerHTML = `
            <div style="padding: 15px; background: ${survives ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">${scenario.name}</h3>
                <p style="color: #64748b; margin-bottom: 10px;">${scenario.description}</p>

                <div style="margin-bottom: 15px;">
                    <h4 style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Liquid Net Worth (Investment Accounts)</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                        <div>
                            <div style="font-size: 12px; color: #64748b;">Normal Final</div>
                            <div style="font-size: 18px; font-weight: 600;">$${normalFinalLiquid.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #64748b;">Stress Final</div>
                            <div style="font-size: 18px; font-weight: 600; color: ${stressFinalLiquid < 0 ? '#ef4444' : 'inherit'};">$${stressFinalLiquid.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #64748b;">Impact</div>
                            <div style="font-size: 18px; font-weight: 600; color: ${impactLiquid < 0 ? '#ef4444' : '#10b981'};">${impactLiquid > 0 ? '+' : ''}${impactLiquid}%</div>
                        </div>
                    </div>
                </div>

                <div style="padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <h4 style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Total Net Worth (Including Home)</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                        <div>
                            <div style="font-size: 12px; color: #64748b;">Normal Final</div>
                            <div style="font-size: 16px; font-weight: 500;">$${normalFinal.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #64748b;">Stress Final</div>
                            <div style="font-size: 16px; font-weight: 500; color: ${stressFinal < 0 ? '#ef4444' : 'inherit'};">$${stressFinal.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #64748b;">Impact</div>
                            <div style="font-size: 16px; font-weight: 500; color: ${impact < 0 ? '#ef4444' : '#10b981'};">${impact > 0 ? '+' : ''}${impact}%</div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <strong style="color: ${survives ? '#10b981' : '#ef4444'};">
                        ${survives ? '✅ Plan survives this scenario!' : '❌ Plan fails - you run out of money!'}
                    </strong>
                </div>
            </div>
        `;
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                ${content}
            </div>
        `;

        // Attach close button listener using querySelector on the modal itself
        setTimeout(() => {
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }

            // Also close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }, 0);

        return modal;
    }

    showPropertyModal(property = null) {
        const isEdit = property !== null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>${isEdit ? 'Edit' : 'Add'} Property</h2>
                    <button class="close-modal">&times;</button>
                </div>

                <h3>Purchase Details</h3>
                <div class="form-group">
                    <label>Property Name</label>
                    <input type="text" id="propertyName" value="${property?.name || 'Primary Residence'}">
                </div>
                <div class="form-group">
                    <label>Purchase Year</label>
                    <input type="number" id="purchaseYear" value="${property?.purchaseYear || this.model.settings.planStartYear}">
                </div>
                <div class="form-group">
                    <label>Purchase Price ($)</label>
                    <input type="number" id="purchasePrice" value="${property?.purchasePrice || 0}" step="1000">
                </div>
                <div class="form-group">
                    <label>Down Payment ($)</label>
                    <input type="number" id="downPayment" value="${property?.downPayment || 0}" step="1000">
                </div>
                <div class="form-group">
                    <label>Closing Costs ($) <small style="color: #64748b;">Typical: 2-5% of purchase price</small></label>
                    <input type="number" id="closingCosts" value="${property?.closingCosts || 0}" step="500">
                </div>

                <h3>Mortgage</h3>
                <div class="form-group">
                    <label>Interest Rate (%)</label>
                    <input type="number" id="interestRate" value="${property?.interestRate || 6.5}" step="0.125">
                </div>
                <div class="form-group">
                    <label>Loan Term (years)</label>
                    <input type="number" id="loanTermYears" value="${property?.loanTermYears || 30}">
                </div>
                <div class="form-group">
                    <label>Extra Monthly Payment ($)</label>
                    <input type="number" id="extraPaymentMonthly" value="${property?.extraPaymentMonthly || 0}">
                </div>

                <h3>Ongoing Costs</h3>
                <div class="form-group">
                    <label>Property Tax Rate (% of value/year)</label>
                    <input type="number" id="propertyTaxRate" value="${property?.propertyTaxRate || 1.0}" step="0.1">
                </div>
                <div class="form-group">
                    <label>Insurance ($/year)</label>
                    <input type="number" id="insuranceAnnual" value="${property?.insuranceAnnual || 0}">
                </div>
                <div class="form-group">
                    <label>HOA ($/month)</label>
                    <input type="number" id="hoaMonthly" value="${property?.hoaMonthly || 0}">
                </div>
                <div class="form-group">
                    <label>Maintenance (% of value/year)</label>
                    <input type="number" id="maintenanceRate" value="${property?.maintenanceRate || 1.0}" step="0.1">
                </div>

                <h3>Appreciation & Sale</h3>
                <div class="form-group">
                    <label>Appreciation Rate (%/year)</label>
                    <input type="number" id="appreciationRate" value="${property?.appreciationRate || 3.0}" step="0.1">
                </div>
                <div class="form-group">
                    <label>Planned Sale Year <small style="color: #64748b;">(Optional - leave blank if not selling)</small></label>
                    <input type="number" id="sellYear" value="${property?.sellYear || ''}" placeholder="e.g., 2040">
                </div>
                <div class="form-group">
                    <label>Selling Costs (% of sale price) <small style="color: #64748b;">Typical: 8-10% (realtor fees + closing)</small></label>
                    <input type="number" id="sellingCosts" value="${property?.sellingCosts || 8}" step="0.5" min="0" max="20">
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" id="cancelPropertyBtn">Cancel</button>
                    <button class="btn btn-primary" id="savePropertyBtn">${isEdit ? 'Update' : 'Add'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners with setTimeout to ensure DOM is ready
        setTimeout(() => {
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }

            const cancelBtn = document.getElementById('cancelPropertyBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.closeModal());
            }

            const saveBtn = document.getElementById('savePropertyBtn');
            if (saveBtn) {
                // Use once: true to prevent duplicate event handlers
                saveBtn.addEventListener('click', () => {
                    if (isEdit) this.updateProperty(property.id);
                    else this.addProperty();
                }, { once: true });
            }
        }, 0);
    }

    showCreditCardModal(card = null) {
        const isEdit = card !== null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${isEdit ? 'Edit' : 'Add'} Credit Card</h2>
                    <button class="close-modal">&times;</button>
                </div>

                <div class="form-group">
                    <label>Card Name</label>
                    <input type="text" id="cardName" value="${card?.name || ''}" placeholder="Chase Sapphire">
                </div>
                <div class="form-group">
                    <label>Current Balance ($)</label>
                    <input type="number" id="cardBalance" value="${card?.balance || 0}">
                </div>
                <div class="form-group">
                    <label>APR (%)</label>
                    <input type="number" id="cardAPR" value="${card?.apr || 18.0}" step="0.1">
                </div>
                <div class="form-group">
                    <label>Minimum Payment (% of balance)</label>
                    <input type="number" id="minPaymentPercent" value="${card?.minimumPaymentPercent || 2.0}" step="0.1">
                    <small>Typical: 2-3% of balance</small>
                </div>
                <div class="form-group">
                    <label>Extra Monthly Payment ($)</label>
                    <input type="number" id="extraPayment" value="${card?.extraPayment || 0}">
                    <small>Additional payment beyond minimum to pay off faster</small>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" id="cancelCardBtn">Cancel</button>
                    <button class="btn btn-primary" id="saveCardBtn">${isEdit ? 'Update' : 'Add'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        document.getElementById('cancelCardBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveCardBtn').addEventListener('click', () => {
            if (isEdit) this.updateCreditCard(card.id);
            else this.addCreditCard();
        });
    }

    showLoanModal(loan = null) {
        const isEdit = loan !== null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${isEdit ? 'Edit' : 'Add'} Loan</h2>
                    <button class="close-modal">&times;</button>
                </div>

                <div class="form-group">
                    <label>Loan Name</label>
                    <input type="text" id="loanName" value="${loan?.name || ''}" placeholder="Auto Loan">
                </div>
                <div class="form-group">
                    <label>Loan Type</label>
                    <select id="loanType">
                        <option value="auto" ${loan?.type === 'auto' ? 'selected' : ''}>Auto Loan</option>
                        <option value="student" ${loan?.type === 'student' ? 'selected' : ''}>Student Loan</option>
                        <option value="personal" ${loan?.type === 'personal' ? 'selected' : ''}>Personal Loan</option>
                        <option value="other" ${loan?.type === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Current Balance ($)</label>
                    <input type="number" id="loanBalance" value="${loan?.balance || 0}">
                </div>
                <div class="form-group">
                    <label>Interest Rate (%)</label>
                    <input type="number" id="loanRate" value="${loan?.interestRate || 5.0}" step="0.1">
                </div>
                <div class="form-group">
                    <label>Monthly Payment ($)</label>
                    <input type="number" id="loanPayment" value="${loan?.monthlyPayment || 0}">
                </div>
                <div class="form-group">
                    <label>Start Year</label>
                    <input type="number" id="loanStartYear" value="${loan?.startYear || this.model.settings.planStartYear}">
                </div>
                <div class="form-group">
                    <label>Loan Term (years)</label>
                    <input type="number" id="loanTerm" value="${loan?.termYears || 5}">
                </div>

                <div id="loanPayoffCalculator" style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0;">💡 Payoff Calculator</h4>
                    <div id="payoffProjections" style="font-size: 14px; color: #475569;">
                        Enter loan details above to see projected payoff amounts
                    </div>
                </div>

                <h3 style="margin-top: 20px;">Payoff & Forgiveness (Optional)</h3>
                <div class="form-group">
                    <label>Pay Off in Year (optional)</label>
                    <input type="number" id="loanPayoffYear" value="${loan?.payoffYear || ''}" placeholder="Leave empty for normal amortization">
                    <small>Specify a year to pay off the remaining balance with a lump sum</small>
                </div>

                <div class="form-group">
                    <label>Forgiveness Year (optional)</label>
                    <input type="number" id="loanForgiveYear" value="${loan?.forgiveYear || ''}" placeholder="E.g., PSLF after 10 years">
                    <small>Year when loan is forgiven (e.g., Public Service Loan Forgiveness)</small>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="loanForgivenessIsTaxable" ${loan?.forgivenessIsTaxable ? 'checked' : ''}>
                        Forgiveness is taxable (tax bomb)
                    </label>
                    <small>Check if forgiven amount will be treated as taxable income</small>
                </div>

                <div class="form-group">
                    <label>Forgiveness Amount (optional)</label>
                    <input type="number" id="loanForgivenessAmount" value="${loan?.forgivenessAmount || ''}" placeholder="Leave empty for full remaining balance">
                    <small>Specific amount to be forgiven (or leave empty for entire balance)</small>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" id="cancelLoanBtn">Cancel</button>
                    <button class="btn btn-primary" id="saveLoanBtn">${isEdit ? 'Update' : 'Add'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        document.getElementById('cancelLoanBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveLoanBtn').addEventListener('click', () => {
            if (isEdit) this.updateLoan(loan.id);
            else this.addLoan();
        });

        // Add loan payoff calculator
        const updatePayoffCalculator = () => {
            const balance = parseFloat(document.getElementById('loanBalance').value) || 0;
            const rate = parseFloat(document.getElementById('loanRate').value) || 0;
            const payment = parseFloat(document.getElementById('loanPayment').value) || 0;
            const startYear = parseInt(document.getElementById('loanStartYear').value) || this.model.settings.planStartYear;
            const termYears = parseInt(document.getElementById('loanTerm').value) || 10;

            if (balance <= 0 || payment <= 0) {
                document.getElementById('payoffProjections').innerHTML = 'Enter loan details above to see projected payoff amounts';
                return;
            }

            // Calculate payoff amounts for the full loan term (or until paid off)
            const monthlyRate = rate / 100 / 12;
            let projections = [];
            let currentBalance = balance;
            const maxYears = Math.min(termYears, 40); // Cap at 40 years for display

            for (let year = 0; year <= maxYears; year++) {
                const targetYear = startYear + year;
                const monthsElapsed = year * 12;

                // Calculate balance at this year
                let yearBalance = balance;
                for (let m = 0; m < monthsElapsed; m++) {
                    const interest = yearBalance * monthlyRate;
                    const principal = payment - interest;
                    yearBalance -= principal;
                    if (yearBalance <= 0) break;
                }

                if (yearBalance > 0) {
                    projections.push({ year: targetYear, balance: Math.round(yearBalance) });
                } else {
                    break; // Loan is paid off
                }
            }

            if (projections.length === 0) {
                document.getElementById('payoffProjections').innerHTML = 'Loan will be paid off before next year 🎉';
            } else {
                let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
                projections.forEach(p => {
                    html += `<div><strong>${p.year}:</strong> $${p.balance.toLocaleString()}</div>`;
                });
                html += '</div>';
                document.getElementById('payoffProjections').innerHTML = html;
            }
        };

        // Update calculator when fields change
        ['loanBalance', 'loanRate', 'loanPayment', 'loanStartYear'].forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('input', updatePayoffCalculator);
            }
        });

        // Initial calculation
        updatePayoffCalculator();
    }

    closeModal() {
        try {
            console.log('🚪 closeModal() called');
            // Find ALL modals and log them
            const allModals = document.querySelectorAll('.modal');
            console.log(`Found ${allModals.length} modals:`, Array.from(allModals).map(m => ({
                id: m.id,
                className: m.className,
                display: m.style.display
            })));

            // Find the active modal (visible one) - this is the one we want to close
            const activeModal = document.querySelector('.modal.active');
            console.log('Active modal to close:', activeModal);

            if (activeModal) {
                activeModal.remove();
                console.log('✅ Active modal removed');
            } else {
                console.warn('⚠️ No active modal found to close');
            }
        } catch (error) {
            console.error('❌ Error closing modal:', error);
        }
    }

    saveData() {
        console.log('💾 saveData() called, currentScenarioId:', this.currentScenarioId);
        console.log('💾 Current working data - housing:', {
            rentalPeriods: this.model.housing.rentalPeriods?.length || 0,
            ownedProperties: this.model.housing.ownedProperties?.length || 0
        });

        // Decide what to save based on current state
        let dataToSave;

        if (this.currentScenarioId === null) {
            // Viewing base plan - save current working data as base plan
            console.log('💾 Saving base plan');
            dataToSave = {
                basePlan: this.getCurrentPlanData(),
                scenarios: this.scenarios,
                currentScenarioId: null
            };
        } else {
            // Viewing a scenario - save base plan (if exists) and scenarios list
            console.log('💾 Saving while viewing scenario', this.currentScenarioId);
            dataToSave = {
                basePlan: this.basePlan || this.getCurrentPlanData(),
                scenarios: this.scenarios,
                currentScenarioId: this.currentScenarioId
            };
        }

        localStorage.setItem('financialModel', JSON.stringify(dataToSave));
        console.log('✅ localStorage.setItem completed');
    }

    loadData() {
        const data = localStorage.getItem('financialModel');
        if (data) {
            const parsed = JSON.parse(data);

            // NEW FORMAT: basePlan + scenarios list
            if (parsed.basePlan && parsed.scenarios !== undefined) {
                console.log('📥 Loading NEW format data');
                this.scenarios = parsed.scenarios || [];

                // Check if we were viewing a scenario
                if (parsed.currentScenarioId) {
                    const scenario = this.scenarios.find(s => s.id === parsed.currentScenarioId);
                    if (scenario) {
                        console.log('📥 Restoring scenario view:', parsed.currentScenarioId);
                        this.basePlan = parsed.basePlan;
                        this.loadPlanData(scenario.data);
                        this.currentScenarioId = parsed.currentScenarioId;
                        return;
                    }
                }

                // Load base plan as working data
                console.log('📥 Loading base plan as working data');
                this.loadPlanData(parsed.basePlan);
                this.currentScenarioId = null;
                return;
            }

            // OLD FORMAT: all data directly in parsed object
            console.log('📥 Loading OLD format data - will migrate');
            console.log('🔍 Raw localStorage housing.rentalPeriods:', parsed.housing?.rentalPeriods);
            this.model.accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
            this.model.incomes = (Array.isArray(parsed.incomes) ? parsed.incomes : []).map(inc => ({
                ...inc,
                ownerId: inc.ownerId || 'household',
                phasedRetirement: inc.phasedRetirement || null
            }));
            this.model.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
            this.model.milestones = (Array.isArray(parsed.milestones) ? parsed.milestones : []).map(m => ({
                ...m,
                ownerId: m.ownerId || 'household'
            }));

            // Handle backwards compatibility with old settings format
            if (parsed.settings) {
                if (parsed.settings.household) {
                    // New format - ensure socialSecurity fields exist
                    this.model.settings = parsed.settings;

                    // Add missing socialSecurity to Person A if needed
                    if (!this.model.settings.household.personA.socialSecurity) {
                        this.model.settings.household.personA.socialSecurity = {
                            enabled: false,
                            annualAmount: 0,
                            startAge: 67
                        };
                    }

                    // Add missing socialSecurity to Person B if needed
                    if (this.model.settings.household.personB && !this.model.settings.household.personB.socialSecurity) {
                        this.model.settings.household.personB.socialSecurity = {
                            enabled: false,
                            annualAmount: 0,
                            startAge: 67
                        };
                    }

                    // Add missing pension if needed
                    if (!this.model.settings.pension) {
                        this.model.settings.pension = {
                            enabled: false,
                            owner: 'personA',
                            name: '',
                            annualAmount: 0,
                            startYear: this.model.settings.planStartYear,
                            growth: 0
                        };
                    }
                } else {
                    // Old format - migrate to new format
                    const currentYear = new Date().getFullYear();
                    this.model.settings = {
                        planStartYear: currentYear,
                        projectionHorizon: 40,
                        inflation: parsed.settings.inflation || 3.0,
                        filingStatus: parsed.settings.filingStatus || 'single',
                        household: {
                            personA: {
                                name: 'Person A',
                                birthYear: currentYear - (parsed.settings.currentAge || 30),
                                retirementYear: currentYear + ((parsed.settings.retirementAge || 65) - (parsed.settings.currentAge || 30)),
                                lifeExpectancy: parsed.settings.lifeExpectancy || 95,
                                socialSecurity: {
                                    enabled: false,
                                    annualAmount: 0,
                                    startAge: 67
                                }
                            },
                            personB: null
                        },
                        pension: {
                            enabled: false,
                            owner: 'personA',
                            name: '',
                            annualAmount: 0,
                            startYear: currentYear,
                            growth: 0
                        }
                    };
                }
            }

            this.model.investmentGlidePath = parsed.investmentGlidePath || [
                { startYear: new Date().getFullYear(), expectedReturn: 7, volatility: 15 }
            ];

            // Migration: Fix old 'always' withdrawalMode to 'as_needed'
            let withdrawalMode = parsed.withdrawalStrategy?.withdrawalMode || 'as_needed';
            if (withdrawalMode === 'always') {
                console.warn('Migrating withdrawalMode from "always" to "as_needed" - this fixes inheritance timing bug');
                withdrawalMode = 'as_needed';
            }

            this.model.withdrawalStrategy = {
                ...(parsed.withdrawalStrategy || {}),
                type: parsed.withdrawalStrategy?.type || 'fixed_percentage',
                withdrawalPercentage: parsed.withdrawalStrategy?.withdrawalPercentage || 4,
                fixedAmount: parsed.withdrawalStrategy?.fixedAmount || 40000,
                inflationAdjusted: parsed.withdrawalStrategy?.inflationAdjusted !== false,
                dynamicInitialRate: parsed.withdrawalStrategy?.dynamicInitialRate || 5,
                dynamicUpperGuardrail: parsed.withdrawalStrategy?.dynamicUpperGuardrail || 20,
                dynamicLowerGuardrail: parsed.withdrawalStrategy?.dynamicLowerGuardrail || 20,
                rmdStartAge: parsed.withdrawalStrategy?.rmdStartAge || 73,
                withdrawalStartYear: parsed.withdrawalStrategy?.withdrawalStartYear || null,
                autoWithdrawalStart: parsed.withdrawalStrategy?.autoWithdrawalStart !== false,
                withdrawalMode: withdrawalMode,
                taxOptimizedSequence: parsed.withdrawalStrategy?.taxOptimizedSequence || ['cash', 'taxable', 'traditional', 'roth', 'hsa']
            };

            // MIGRATION: Fix old withdrawal sequences that don't include 'cash'
            if (this.model.withdrawalStrategy.taxOptimizedSequence &&
                !this.model.withdrawalStrategy.taxOptimizedSequence.includes('cash')) {
                console.warn('Migrating old withdrawal sequence to include cash accounts');
                this.model.withdrawalStrategy.taxOptimizedSequence.unshift('cash');
            }

            this.scenarios = parsed.scenarios || [];

            // Load housing data with migration from old model
            if (parsed.housing) {
                console.log('📂 Loading housing data from localStorage:', {
                    hasStatus: !!parsed.housing.status,
                    hasRent: !!parsed.housing.rent,
                    hasRentalPeriods: !!parsed.housing.rentalPeriods,
                    rentalPeriodsLength: parsed.housing.rentalPeriods?.length || 0,
                    rentalPeriodsRaw: JSON.stringify(parsed.housing.rentalPeriods),
                    ownedPropertiesLength: parsed.housing.ownedProperties?.length || 0
                });

                // Migration: Convert old housing model (status + rent object) to new model (rentalPeriods array)
                if (parsed.housing.status === 'rent' && parsed.housing.rent) {
                    console.warn('⚠️ Migrating old housing model: converting rent object to rentalPeriods array');
                    // Old model: housing.rent is a single object
                    // New model: housing.rentalPeriods is an array
                    this.model.housing.rentalPeriods = [{
                        id: Date.now(),
                        name: 'Rental',
                        monthlyRent: parsed.housing.rent.monthlyRent || 0,
                        startYear: parsed.housing.rent.startYear || this.model.settings.planStartYear,
                        endYear: parsed.housing.rent.endYear || null,
                        annualIncrease: parsed.housing.rent.annualIncrease || 3.0,
                        securityDeposit: parsed.housing.rent.securityDeposit || 0
                    }];
                    console.warn('✅ Created rental period:', this.model.housing.rentalPeriods[0]);
                } else if (parsed.housing.rentalPeriods) {
                    // New model already exists
                    console.log('📥 Loading existing rentalPeriods array:', parsed.housing.rentalPeriods);
                    this.model.housing.rentalPeriods = parsed.housing.rentalPeriods;
                    console.log('✅ Loaded into model:', {
                        length: this.model.housing.rentalPeriods.length,
                        data: this.model.housing.rentalPeriods
                    });
                } else {
                    // No rental data
                    console.log('ℹ️ No rental data in localStorage, initializing empty array');
                    this.model.housing.rentalPeriods = [];
                }

                // Load owned properties (works with both old and new models)
                if (parsed.housing.ownedProperties) {
                    this.model.housing.ownedProperties = parsed.housing.ownedProperties;
                } else {
                    this.model.housing.ownedProperties = [];
                }

                // Migration: Fix properties missing loanAmount and monthlyPayment
                let migrationPerformed = false;
                if (this.model.housing.ownedProperties) {
                    this.model.housing.ownedProperties.forEach(property => {
                        // Check if loanAmount is missing or if monthlyPayment is undefined (indicates corrupted data)
                        const needsMigration =
                            property.loanAmount === undefined ||
                            property.loanAmount === null ||
                            property.monthlyPayment === undefined ||
                            property.monthlyPayment === null;

                        if (needsMigration) {
                            migrationPerformed = true;
                            console.warn(`🔧 Migrating property "${property.name}": old loanAmount=${property.loanAmount}, old monthlyPayment=${property.monthlyPayment}`);
                            console.warn(`Property details: purchasePrice=${property.purchasePrice}, downPayment=${property.downPayment}, interestRate=${property.interestRate}, loanTermYears=${property.loanTermYears}`);

                            const loanAmount = (property.purchasePrice || 0) - (property.downPayment || 0);
                            property.loanAmount = loanAmount;
                            console.warn(`✅ Calculated loanAmount=${loanAmount}`);

                            // Recalculate monthly payment
                            if (loanAmount > 0 && property.interestRate > 0 && property.loanTermYears > 0) {
                                const monthlyRate = property.interestRate / 100 / 12;
                                const numPayments = property.loanTermYears * 12;
                                property.monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                                    (Math.pow(1 + monthlyRate, numPayments) - 1);
                                console.warn(`✅ Calculated monthlyPayment=${property.monthlyPayment}`);
                            } else {
                                property.monthlyPayment = 0;
                                console.warn(`✅ Set monthlyPayment=0 (cash purchase or invalid loan data)`);
                            }
                        }
                    });
                }

                // If migration was performed, save the fixed data
                if (migrationPerformed) {
                    console.warn('💾 Saving migrated housing data to localStorage...');
                    setTimeout(() => this.saveData(), 100);
                }
            }

            // Load debts data
            if (parsed.debts) {
                this.model.debts = parsed.debts;
            }

            // Handle scenario restoration for old format
            if (parsed.currentScenarioId) {
                const scenario = this.scenarios.find(s => s.id === parsed.currentScenarioId);
                if (scenario) {
                    console.log('📥 OLD FORMAT: Was viewing scenario, loading it now:', parsed.currentScenarioId);
                    // Save what we just loaded as the base plan
                    this.basePlan = this.getCurrentPlanData();
                    // Load the scenario data into working model
                    this.loadPlanData(scenario.data);
                    this.currentScenarioId = parsed.currentScenarioId;
                } else {
                    console.log('📥 OLD FORMAT: Scenario was deleted, using loaded data as base plan');
                    this.currentScenarioId = null;
                    // Recreate projection engine with loaded model
                    this.projectionEngine = new ProjectionEngine(this.model);
                    this.simulator = new MonteCarloSimulator(this.model, this.projectionEngine);
                }
            } else {
                console.log('📥 OLD FORMAT: Loading as base plan');
                // Not viewing a scenario, recreate projection engine with loaded model
                this.projectionEngine = new ProjectionEngine(this.model);
                this.simulator = new MonteCarloSimulator(this.model, this.projectionEngine);
            }
        }
    }

    parseCSVImport(csvContent) {
        // Parse CSV back into the data structure
        // Normalize line endings: handle CRLF (\r\n), CR (\r), and LF (\n)
        // Excel on Windows uses CRLF, old Mac uses CR, Unix/modern uses LF
        const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedContent.split('\n');

        const data = {
            accounts: [],
            incomes: [],
            expenses: [],
            milestones: [],
            settings: { household: { personA: {}, personB: null }, pension: {} },
            investmentGlidePath: [],
            withdrawalStrategy: {},
            housing: { rentalPeriods: [], ownedProperties: [] },
            debts: { creditCards: [], loans: [] },
            scenarios: []
        };

        let currentSection = null;
        let headers = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;


            // Section headers (check if line starts with [ and contains ])
            if (line.startsWith('[')) {
                // Extract section name between [ and ]
                const closeBracket = line.indexOf(']');
                if (closeBracket > 0) {
                    currentSection = line.slice(1, closeBracket);
                    headers = [];
                    continue;
                }
            }

            // Parse CSV line (handle quoted values)
            const parseLine = (line) => {
                const result = [];
                let current = '';
                let inQuotes = false;

                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        if (inQuotes && line[j + 1] === '"') {
                            current += '"';
                            j++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        result.push(current);
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current);

                // Remove trailing empty values that Excel/Numbers adds
                while (result.length > 0 && result[result.length - 1] === '') {
                    result.pop();
                }

                return result;
            };

            const values = parseLine(line);

            // Skip empty lines (lines with no values after removing trailing empties)
            if (values.length === 0) {
                continue;
            }

            // First line after section is headers
            if (headers.length === 0 && currentSection) {
                headers = values;
                continue;
            }

            // Parse data based on section
            if (!currentSection) {
                continue;
            }


            const parseRow = () => {
                const obj = {};
                headers.forEach((header, idx) => {
                    let val = values[idx] || '';
                    // Try to parse as number
                    if (val && !isNaN(val) && val !== '') {
                        obj[header] = parseFloat(val);
                    } else if (val === 'true' || val === 'TRUE') {
                        obj[header] = true;
                    } else if (val === 'false' || val === 'FALSE') {
                        obj[header] = false;
                    } else {
                        obj[header] = val;
                    }
                });
                return obj;
            };

            switch (currentSection) {
                case 'SETTINGS':
                    const settings = parseRow();
                    data.settings.planStartYear = settings.PlanStartYear;
                    data.settings.projectionHorizon = settings.ProjectionHorizon;
                    data.settings.inflation = settings.Inflation;
                    data.settings.filingStatus = settings.FilingStatus;
                    break;

                case 'PERSON_A':
                    const personA = parseRow();
                    data.settings.household.personA = {
                        name: personA.Name,
                        birthYear: personA.BirthYear,
                        retirementYear: personA.RetirementYear,
                        lifeExpectancy: personA.LifeExpectancy,
                        socialSecurity: {
                            enabled: personA.SS_Enabled,
                            annualAmount: personA.SS_Amount,
                            startAge: personA.SS_StartAge
                        }
                    };
                    break;

                case 'PERSON_B':
                    const personB = parseRow();
                    data.settings.household.personB = {
                        name: personB.Name,
                        birthYear: personB.BirthYear,
                        retirementYear: personB.RetirementYear,
                        lifeExpectancy: personB.LifeExpectancy,
                        socialSecurity: {
                            enabled: personB.SS_Enabled,
                            annualAmount: personB.SS_Amount,
                            startAge: personB.SS_StartAge
                        }
                    };
                    break;

                case 'ACCOUNTS':
                    const account = parseRow();
                    data.accounts.push({
                        id: Date.now() + Math.random(),
                        name: account.Name,
                        type: account.Type,
                        originalType: account.Type,
                        balance: account.Balance,
                        interestRate: account.InterestRate,
                        taxAdvantaged: ['traditional', 'roth', 'hsa'].includes(account.Type)
                    });
                    break;

                case 'INCOMES':
                    const income = parseRow();
                    data.incomes.push({
                        id: Date.now() + Math.random(),
                        name: income.Name,
                        amount: income.Amount,
                        frequency: income.Frequency,
                        startYear: income.StartYear,
                        endYear: income.EndYear || null,
                        category: income.Category,
                        growth: income.Growth,
                        ownerId: 'household',
                        phasedRetirement: null
                    });
                    break;

                case 'EXPENSES':
                    const expense = parseRow();
                    data.expenses.push({
                        id: Date.now() + Math.random(),
                        name: expense.Name,
                        amount: expense.Amount,
                        frequency: expense.Frequency,
                        startYear: expense.StartYear,
                        endYear: expense.EndYear || null,
                        category: expense.Category,
                        growth: expense.Growth
                    });
                    break;

                case 'HOUSING_RENTAL':
                    // OLD FORMAT - convert to rental period for backward compatibility
                    const rental = parseRow();
                    if (!data.housing.rentalPeriods) {
                        data.housing.rentalPeriods = [];
                    }
                    data.housing.rentalPeriods.push({
                        id: Date.now() + Math.random(),
                        name: 'Rental',
                        monthlyRent: rental.MonthlyRent,
                        startYear: rental.StartYear,
                        endYear: null,
                        annualIncrease: rental.AnnualIncrease,
                        securityDeposit: 0
                    });
                    break;

                case 'HOUSING_RENTAL_PERIODS':
                    // NEW FORMAT - rental periods array
                    const rentalPeriod = parseRow();
                    if (!data.housing.rentalPeriods) {
                        data.housing.rentalPeriods = [];
                    }
                    data.housing.rentalPeriods.push({
                        id: Date.now() + Math.random(),
                        name: rentalPeriod.Name,
                        monthlyRent: rentalPeriod.MonthlyRent,
                        startYear: rentalPeriod.StartYear,
                        endYear: rentalPeriod.EndYear || null,
                        annualIncrease: rentalPeriod.AnnualIncrease,
                        securityDeposit: rentalPeriod.SecurityDeposit || 0
                    });
                    break;

                case 'HOUSING_OWNED':
                    // OLD FORMAT - for backward compatibility
                    const property = parseRow();
                    const loanAmount = property.PurchasePrice - property.DownPayment;
                    if (!data.housing.ownedProperties) {
                        data.housing.ownedProperties = [];
                    }
                    data.housing.ownedProperties.push({
                        id: Date.now() + Math.random(),
                        name: property.Name,
                        purchaseYear: property.PurchaseYear,
                        sellYear: null,
                        purchasePrice: property.PurchasePrice,
                        downPayment: property.DownPayment,
                        loanAmount: loanAmount,
                        interestRate: property.InterestRate,
                        loanTermYears: property.LoanTermYears,
                        propertyTaxRate: property.PropertyTaxRate,
                        insuranceAnnual: property.InsuranceAnnual,
                        hoaMonthly: property.HOA_Monthly || 0,
                        maintenanceRate: property.MaintenanceRate,
                        appreciationRate: property.AppreciationRate,
                        extraPaymentMonthly: 0,
                        sellingCosts: 0,
                        closingCosts: 0
                    });
                    break;

                case 'HOUSING_OWNED_PROPERTIES':
                    // NEW FORMAT - owned properties array
                    const ownedProperty = parseRow();
                    const loanAmt = ownedProperty.PurchasePrice - ownedProperty.DownPayment;
                    if (!data.housing.ownedProperties) {
                        data.housing.ownedProperties = [];
                    }
                    data.housing.ownedProperties.push({
                        id: Date.now() + Math.random(),
                        name: ownedProperty.Name,
                        purchaseYear: ownedProperty.PurchaseYear,
                        sellYear: ownedProperty.SellYear || null,
                        purchasePrice: ownedProperty.PurchasePrice,
                        downPayment: ownedProperty.DownPayment,
                        loanAmount: loanAmt,
                        interestRate: ownedProperty.InterestRate,
                        loanTermYears: ownedProperty.LoanTermYears,
                        propertyTaxRate: ownedProperty.PropertyTaxRate,
                        insuranceAnnual: ownedProperty.InsuranceAnnual,
                        hoaMonthly: ownedProperty.HOA_Monthly || 0,
                        maintenanceRate: ownedProperty.MaintenanceRate,
                        appreciationRate: ownedProperty.AppreciationRate,
                        extraPaymentMonthly: ownedProperty.ExtraPaymentMonthly || 0,
                        sellingCosts: ownedProperty.SellingCosts || 0,
                        closingCosts: ownedProperty.ClosingCosts || 0
                    });
                    break;

                case 'CREDIT_CARDS':
                    const card = parseRow();
                    data.debts.creditCards.push({
                        id: Date.now() + Math.random(),
                        name: card.Name,
                        balance: card.Balance,
                        apr: card.APR,
                        minimumPaymentPercent: card.MinimumPaymentPercent,
                        extraPayment: card.ExtraPayment
                    });
                    break;

                case 'LOANS':
                    const loan = parseRow();
                    data.debts.loans.push({
                        id: Date.now() + Math.random(),
                        name: loan.Name,
                        type: loan.Type,
                        balance: loan.Balance,
                        interestRate: loan.InterestRate,
                        monthlyPayment: loan.MonthlyPayment,
                        startYear: loan.StartYear,
                        termYears: loan.TermYears
                    });
                    break;

                case 'MILESTONES':
                    const milestone = parseRow();
                    data.milestones.push({
                        id: Date.now() + Math.random(),
                        name: milestone.Name,
                        type: milestone.Type,
                        year: milestone.Year,
                        cost: milestone.Cost,
                        isPositive: milestone.IsPositive,
                        recurring: milestone.Recurring,
                        recurringAmount: milestone.RecurringAmount,
                        recurringInterval: milestone.RecurringInterval,
                        recurringGrowth: milestone.RecurringGrowth,
                        ownerId: 'household',
                        isTaxable: false,
                        taxableAmount: 0,
                        taxCategory: null
                    });
                    break;

                case 'INVESTMENT_GLIDE_PATH':
                    const segment = parseRow();
                    data.investmentGlidePath.push({
                        startYear: segment.StartYear,
                        expectedReturn: segment.ExpectedReturn,
                        volatility: segment.Volatility
                    });
                    break;

                case 'WITHDRAWAL_STRATEGY':
                    const ws = parseRow();
                    data.withdrawalStrategy = {
                        type: ws.Type,
                        withdrawalPercentage: ws.WithdrawalPercentage,
                        inflationAdjusted: ws.InflationAdjusted,
                        fixedAmount: ws.FixedAmount,
                        fixedInflationAdjusted: false,
                        dynamicInitialRate: 5,
                        dynamicUpperGuardrail: 20,
                        dynamicLowerGuardrail: 20,
                        rmdStartAge: ws.RMD_StartAge,
                        withdrawalStartYear: ws.WithdrawalStartYear || null,
                        autoWithdrawalStart: !ws.WithdrawalStartYear,
                        withdrawalMode: ws.WithdrawalMode,
                        taxOptimizedSequence: ['cash', 'taxable', 'traditional', 'roth', 'hsa']
                    };
                    break;
            }
        }

        // Set default pension if not loaded
        if (!data.settings.pension.enabled) {
            data.settings.pension = {
                enabled: false,
                owner: 'personA',
                name: '',
                annualAmount: 0,
                startYear: data.settings.planStartYear,
                growth: 0
            };
        }

        // Validate that we loaded essential data
        if (data.accounts.length === 0) {
            console.error('WARNING: No accounts were loaded from CSV!');
        }

        return data;
    }

    loadDataFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                let parsed;

                try {
                    // Detect file format and parse accordingly
                    if (file.name.endsWith('.csv')) {
                        parsed = this.parseCSVImport(content);
                    } else {
                        // JSON format
                        parsed = JSON.parse(content);
                    }
                } catch (error) {
                    console.error('Error during import:', error);
                    alert('Error importing file: ' + error.message);
                    return;
                }

                // Detect if this is a scenario file (has name, description, and data wrapper)
                if (parsed.name && parsed.description && parsed.data) {
                    console.log('=== DETECTED SCENARIO FILE ===');
                    console.log('Scenario name:', parsed.name);
                    console.log('Description:', parsed.description);

                    // Confirm with user before importing as scenario
                    const confirmMessage = `Import as new scenario?\n\nName: ${parsed.name}\n\nDescription: ${parsed.description}\n\nThis will add it to your scenarios list without affecting your current plan.`;
                    if (!confirm(confirmMessage)) {
                        console.log('User cancelled scenario import');
                        return;
                    }

                    // Add as a new scenario
                    const newScenario = {
                        id: Date.now(),
                        name: parsed.name,
                        description: parsed.description,
                        date: new Date().toISOString(),
                        data: parsed.data
                    };

                    this.scenarios.push(newScenario);
                    this.saveData();

                    // Switch to scenarios tab to show the new scenario
                    document.querySelector('[data-tab="scenarios"]').click();

                    alert(`✓ Scenario "${parsed.name}" imported successfully!\n\nYou can now view it in the Scenarios tab.`);
                    return;
                }

                // Import as a new scenario
                this.showScenarioNameModal(parsed);
            };
            reader.readAsText(file);
        };
        input.click();
    }

    showScenarioNameModal(parsed) {
        const defaultName = `Imported Scenario ${new Date().toLocaleDateString()}`;

        const modal = this.createModal('Name Your Scenario', `
            <div class="modal-body">
                <div class="form-group">
                    <label>Scenario Name</label>
                    <input type="text" id="scenarioNameInput" value="${defaultName}" placeholder="Enter scenario name">
                </div>

                <div class="form-group">
                    <label>Description (optional)</label>
                    <textarea id="scenarioDescInput" placeholder="Describe what makes this scenario different..." rows="3"></textarea>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary" id="createScenarioBtn">Create Scenario</button>
                </div>
            </div>
        `);

        document.body.appendChild(modal);

        setTimeout(() => {
            // Focus on name input
            const nameInput = document.getElementById('scenarioNameInput');
            nameInput.focus();
            nameInput.select();

            // Handle enter key in name input
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('createScenarioBtn').click();
                }
            });

            document.getElementById('createScenarioBtn').addEventListener('click', () => {
                const name = document.getElementById('scenarioNameInput').value.trim();
                const description = document.getElementById('scenarioDescInput').value.trim();

                if (!name) {
                    alert('Please enter a name for the scenario');
                    return;
                }

                // Create the scenario
                const newScenario = {
                    id: Date.now(),
                    name: name,
                    description: description || 'Imported scenario',
                    date: new Date().toISOString(),
                    data: parsed
                };

                this.scenarios.push(newScenario);
                this.saveData();
                this.closeModal();

                // View the new scenario automatically
                this.viewScenario(newScenario.id);

                alert(`✓ Scenario "${name}" imported!\n\nYou're now viewing this scenario. Go to the Scenarios tab to switch between scenarios.`);
            });
        }, 0);
    }

    exportData() {
        // Create both a JSON export (for re-importing) and a human-readable text export
        const data = {
            accounts: this.model.accounts,
            incomes: this.model.incomes,
            expenses: this.model.expenses,
            milestones: this.model.milestones,
            settings: this.model.settings,
            investmentGlidePath: this.model.investmentGlidePath,
            withdrawalStrategy: this.model.withdrawalStrategy,
            housing: this.model.housing,
            debts: this.model.debts,
            scenarios: this.scenarios
        };

        // Export as human-readable/editable CSV (primary export for editing)
        const csv = this.generateCSVExport(data);
        const csvBlob = new Blob([csv], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `financial-plan-${new Date().toISOString().split('T')[0]}.csv`;
        csvLink.click();
        URL.revokeObjectURL(csvUrl);

        alert('✓ Exported to CSV format. You can edit this file in Excel or any text editor and re-import it.');
    }

    generateCSVExport(data) {
        // CSV format that can be edited in Excel and re-imported
        // Using sections with headers for easy editing
        let csv = '';

        // Helper to escape CSV values
        const esc = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // Settings
        csv += '[SETTINGS]\n';
        csv += 'PlanStartYear,ProjectionHorizon,Inflation,FilingStatus\n';
        csv += `${data.settings.planStartYear},${data.settings.projectionHorizon},${data.settings.inflation},${data.settings.filingStatus}\n`;
        csv += '\n';

        // Person A
        csv += '[PERSON_A]\n';
        csv += 'Name,BirthYear,RetirementYear,LifeExpectancy,SS_Enabled,SS_Amount,SS_StartAge\n';
        const personA = data.settings.household.personA;
        csv += `${esc(personA.name)},${personA.birthYear},${personA.retirementYear},${personA.lifeExpectancy},${personA.socialSecurity.enabled},${personA.socialSecurity.annualAmount},${personA.socialSecurity.startAge}\n`;
        csv += '\n';

        // Person B
        if (data.settings.household.personB) {
            csv += '[PERSON_B]\n';
            csv += 'Name,BirthYear,RetirementYear,LifeExpectancy,SS_Enabled,SS_Amount,SS_StartAge\n';
            const personB = data.settings.household.personB;
            csv += `${esc(personB.name)},${personB.birthYear},${personB.retirementYear},${personB.lifeExpectancy},${personB.socialSecurity.enabled},${personB.socialSecurity.annualAmount},${personB.socialSecurity.startAge}\n`;
            csv += '\n';
        }

        // Accounts
        csv += '[ACCOUNTS]\n';
        csv += 'Name,Type,Balance,InterestRate\n';
        data.accounts.forEach(acc => {
            csv += `${esc(acc.name)},${acc.type},${acc.balance},${acc.interestRate}\n`;
        });
        csv += '\n';

        // Incomes
        csv += '[INCOMES]\n';
        csv += 'Name,Amount,Frequency,StartYear,EndYear,Category,Growth\n';
        data.incomes.forEach(inc => {
            csv += `${esc(inc.name)},${inc.amount},${inc.frequency},${inc.startYear},${inc.endYear || ''},${inc.category},${inc.growth}\n`;
        });
        csv += '\n';

        // Expenses
        csv += '[EXPENSES]\n';
        csv += 'Name,Amount,Frequency,StartYear,EndYear,Category,Growth\n';
        data.expenses.forEach(exp => {
            csv += `${esc(exp.name)},${exp.amount},${exp.frequency},${exp.startYear},${exp.endYear || ''},${exp.category},${exp.growth}\n`;
        });
        csv += '\n';

        // Housing - Rental Periods
        if (data.housing.rentalPeriods && data.housing.rentalPeriods.length > 0) {
            csv += '[HOUSING_RENTAL_PERIODS]\n';
            csv += 'Name,MonthlyRent,StartYear,EndYear,AnnualIncrease,SecurityDeposit\n';
            data.housing.rentalPeriods.forEach(rental => {
                csv += `${esc(rental.name)},${rental.monthlyRent},${rental.startYear},${rental.endYear || ''},${rental.annualIncrease},${rental.securityDeposit || 0}\n`;
            });
            csv += '\n';
        }

        // Housing - Owned Properties
        if (data.housing.ownedProperties && data.housing.ownedProperties.length > 0) {
            csv += '[HOUSING_OWNED_PROPERTIES]\n';
            csv += 'Name,PurchaseYear,SellYear,PurchasePrice,DownPayment,InterestRate,LoanTermYears,PropertyTaxRate,InsuranceAnnual,HOA_Monthly,MaintenanceRate,AppreciationRate,ExtraPaymentMonthly,SellingCosts,ClosingCosts\n';
            data.housing.ownedProperties.forEach(prop => {
                csv += `${esc(prop.name)},${prop.purchaseYear},${prop.sellYear || ''},${prop.purchasePrice},${prop.downPayment},${prop.interestRate},${prop.loanTermYears},${prop.propertyTaxRate},${prop.insuranceAnnual},${prop.hoaMonthly || 0},${prop.maintenanceRate},${prop.appreciationRate},${prop.extraPaymentMonthly || 0},${prop.sellingCosts || 0},${prop.closingCosts || 0}\n`;
            });
            csv += '\n';
        }

        // Debts - Credit Cards
        if (data.debts.creditCards.length > 0) {
            csv += '[CREDIT_CARDS]\n';
            csv += 'Name,Balance,APR,MinimumPaymentPercent,ExtraPayment\n';
            data.debts.creditCards.forEach(card => {
                csv += `${esc(card.name)},${card.balance},${card.apr},${card.minimumPaymentPercent},${card.extraPayment}\n`;
            });
            csv += '\n';
        }

        // Debts - Loans
        if (data.debts.loans.length > 0) {
            csv += '[LOANS]\n';
            csv += 'Name,Type,Balance,InterestRate,MonthlyPayment,StartYear,TermYears\n';
            data.debts.loans.forEach(loan => {
                csv += `${esc(loan.name)},${loan.type},${loan.balance},${loan.interestRate},${loan.monthlyPayment},${loan.startYear},${loan.termYears}\n`;
            });
            csv += '\n';
        }

        // Milestones
        if (data.milestones.length > 0) {
            csv += '[MILESTONES]\n';
            csv += 'Year,Name,Type,Cost,IsPositive,Recurring,RecurringAmount,RecurringInterval,RecurringGrowth\n';
            data.milestones.forEach(m => {
                csv += `${m.year},${esc(m.name)},${m.type},${m.cost},${m.isPositive},${m.recurring || false},${m.recurringAmount || 0},${m.recurringInterval || 1},${m.recurringGrowth || 0}\n`;
            });
            csv += '\n';
        }

        // Investment Glide Path
        csv += '[INVESTMENT_GLIDE_PATH]\n';
        csv += 'StartYear,ExpectedReturn,Volatility\n';
        data.investmentGlidePath.forEach(segment => {
            csv += `${segment.startYear},${segment.expectedReturn},${segment.volatility}\n`;
        });
        csv += '\n';

        // Withdrawal Strategy
        csv += '[WITHDRAWAL_STRATEGY]\n';
        csv += 'Type,WithdrawalPercentage,InflationAdjusted,FixedAmount,RMD_StartAge,WithdrawalStartYear,WithdrawalMode\n';
        csv += `${data.withdrawalStrategy.type},${data.withdrawalStrategy.withdrawalPercentage || 4},${data.withdrawalStrategy.inflationAdjusted},${data.withdrawalStrategy.fixedAmount || 0},${data.withdrawalStrategy.rmdStartAge},${data.withdrawalStrategy.withdrawalStartYear || ''},${data.withdrawalStrategy.withdrawalMode}\n`;
        csv += '\n';

        return csv;
    }

    generateHumanReadableExport_OLD(data) {
        const fmt = (num) => '$' + num.toLocaleString();
        let output = `FINANCIAL PLAN EXPORT
Generated: ${new Date().toLocaleString()}
Plan Period: ${data.settings.planStartYear} - ${data.settings.planStartYear + data.settings.projectionHorizon}

================================================================================
HOUSEHOLD INFORMATION
================================================================================
Filing Status: ${data.settings.filingStatus}
Person A: ${data.settings.household.personA.name} (born ${data.settings.household.personA.birthYear})
  - Retirement Year: ${data.settings.household.personA.retirementYear}
  - Social Security: ${data.settings.household.personA.socialSecurity.enabled ? fmt(data.settings.household.personA.socialSecurity.annualAmount) + '/year starting age ' + data.settings.household.personA.socialSecurity.startAge : 'Not configured'}
`;

        if (data.settings.household.personB) {
            output += `Person B: ${data.settings.household.personB.name} (born ${data.settings.household.personB.birthYear})
  - Retirement Year: ${data.settings.household.personB.retirementYear}
  - Social Security: ${data.settings.household.personB.socialSecurity.enabled ? fmt(data.settings.household.personB.socialSecurity.annualAmount) + '/year starting age ' + data.settings.household.personB.socialSecurity.startAge : 'Not configured'}
`;
        }

        output += `
================================================================================
ACCOUNTS (Total: ${fmt(data.accounts.reduce((sum, a) => sum + a.balance, 0))})
================================================================================
`;
        data.accounts.forEach(acc => {
            output += `${acc.name} (${acc.type}): ${fmt(acc.balance)} @ ${acc.interestRate}%
`;
        });

        output += `
================================================================================
INCOME
================================================================================
`;
        data.incomes.forEach(inc => {
            const freq = inc.frequency === 'monthly' ? '/month' : '/year';
            const years = `${inc.startYear}-${inc.endYear || 'ongoing'}`;
            output += `${inc.name}: ${fmt(inc.amount)}${freq} (${years}, ${inc.growth}% growth)
`;
        });

        output += `
================================================================================
EXPENSES
================================================================================
`;
        data.expenses.forEach(exp => {
            const freq = exp.frequency === 'monthly' ? '/month' : '/year';
            const years = `${exp.startYear}-${exp.endYear || 'ongoing'}`;
            output += `${exp.name} (${exp.category}): ${fmt(exp.amount)}${freq} (${years}, ${exp.growth}% growth)
`;
        });

        if (data.housing.status === 'rent' && data.housing.rent.monthlyRent > 0) {
            output += `
================================================================================
HOUSING - RENTAL
================================================================================
Monthly Rent: ${fmt(data.housing.rent.monthlyRent)}
Annual Increase: ${data.housing.rent.annualIncrease}%
`;
        } else if (data.housing.status === 'own' && data.housing.ownedProperties.length > 0) {
            output += `
================================================================================
HOUSING - OWNED PROPERTIES
================================================================================
`;
            data.housing.ownedProperties.forEach(prop => {
                output += `${prop.name}:
  Purchase Year: ${prop.purchaseYear}
  Purchase Price: ${fmt(prop.purchasePrice)}
  Down Payment: ${fmt(prop.downPayment)}
  Mortgage: ${fmt(prop.loanAmount)} @ ${prop.interestRate}% (${prop.loanTermYears} years)
  Property Tax: ${prop.propertyTaxRate}% of value/year
  Insurance: ${fmt(prop.insuranceAnnual)}/year
  HOA: ${fmt(prop.hoaMonthly)}/month
  Maintenance: ${prop.maintenanceRate}% of value/year
  Appreciation: ${prop.appreciationRate}%/year
`;
            });
        }

        if (data.debts.creditCards.length > 0 || data.debts.loans.length > 0) {
            output += `
================================================================================
DEBTS
================================================================================
`;
            data.debts.creditCards.forEach(card => {
                output += `Credit Card - ${card.name}: ${fmt(card.balance)} @ ${card.apr}% APR
  Minimum Payment: ${card.minimumPaymentPercent}% + Extra: ${fmt(card.extraPayment)}/month
`;
            });

            data.debts.loans.forEach(loan => {
                output += `Loan - ${loan.name} (${loan.type}): ${fmt(loan.balance)} @ ${loan.interestRate}%
  Payment: ${fmt(loan.monthlyPayment)}/month (${loan.termYears} year term starting ${loan.startYear})
`;
            });
        }

        if (data.milestones.length > 0) {
            output += `
================================================================================
MILESTONES
================================================================================
`;
            data.milestones.forEach(m => {
                const sign = m.isPositive ? '+' : '-';
                const type = m.recurring ? `Recurring every ${m.recurringInterval} years` : 'One-time';
                output += `${m.year}: ${m.name} (${m.type}) ${sign}${fmt(m.cost)} [${type}]
`;
            });
        }

        output += `
================================================================================
INVESTMENT STRATEGY
================================================================================
`;
        data.investmentGlidePath.forEach(segment => {
            output += `Starting ${segment.startYear}: ${segment.expectedReturn}% return, ${segment.volatility}% volatility
`;
        });

        output += `
================================================================================
WITHDRAWAL STRATEGY
================================================================================
Type: ${data.withdrawalStrategy.type}
Start Year: ${data.withdrawalStrategy.withdrawalStartYear || 'Auto (at retirement)'}
`;
        if (data.withdrawalStrategy.type === 'fixed_percentage') {
            output += `Withdrawal Rate: ${data.withdrawalStrategy.withdrawalPercentage}%
Inflation Adjusted: ${data.withdrawalStrategy.inflationAdjusted ? 'Yes' : 'No'}
`;
        }
        output += `RMD Start Age: ${data.withdrawalStrategy.rmdStartAge}
Tax-Optimized Sequence: ${data.withdrawalStrategy.taxOptimizedSequence.join(' → ')}
`;

        return output;
    }

    exportForAIReview() {
        // Generate a 10-year projection for context
        const projections = this.projectionEngine.projectNetWorth(10);
        const currentYear = new Date().getFullYear();

        // Calculate current financial snapshot
        const totalAssets = this.model.accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const totalIncome = this.model.incomes.reduce((sum, inc) => {
            const multiplier = inc.frequency === 'monthly' ? 12 : 1;
            const activeIncome = (!inc.startYear || currentYear >= inc.startYear) &&
                               (!inc.endYear || currentYear <= inc.endYear);
            return sum + (activeIncome ? inc.amount * multiplier : 0);
        }, 0);
        const totalExpenses = this.model.expenses.reduce((sum, exp) => {
            const multiplier = exp.frequency === 'monthly' ? 12 : 1;
            const activeExpense = (!exp.startYear || currentYear >= exp.startYear) &&
                                (!exp.endYear || currentYear <= exp.endYear);
            return sum + (activeExpense ? exp.amount * multiplier : 0);
        }, 0);
        const annualSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (annualSavings / totalIncome * 100) : 0;

        // Create comprehensive AI-readable export
        const aiReadableExport = {
            "_meta": {
                "export_date": new Date().toISOString(),
                "version": "1.0",
                "tool": "Financial Projection Lab",
                "purpose": "AI-assisted financial planning review and optimization",
                "data_format": "This export contains a complete financial plan with current snapshot, household details, accounts, income/expense projections, investment strategy, and 10-year forward projection"
            },

            "_executive_summary": {
                "about_this_plan": `This is a comprehensive ${this.model.settings.projectionHorizon}-year financial projection for ${this.model.settings.household.personB ? 'a couple' : 'an individual'} with ${this.model.accounts.length} investment/savings accounts totaling $${totalAssets.toLocaleString()}. The plan projects income, expenses, taxes, investment returns, and account balances through ${this.model.settings.planStartYear + this.model.settings.projectionHorizon}.`,

                "key_facts": {
                    "current_net_worth": totalAssets,
                    "annual_income": totalIncome,
                    "annual_expenses": totalExpenses,
                    "annual_savings": annualSavings,
                    "savings_rate": Math.round(savingsRate * 10) / 10 + "%",
                    "years_to_retirement": this.model.settings.household.personA.retirementYear - this.model.settings.planStartYear,
                    "retirement_duration": this.model.settings.household.personA.lifeExpectancy - (this.model.settings.household.personA.retirementYear - this.model.settings.household.personA.birthYear),
                    "withdrawal_strategy": this.model.withdrawalStrategy.type === 'fixed_percentage' ? `${this.model.withdrawalStrategy.withdrawalPercentage}% rule (safe withdrawal rate)` : this.model.withdrawalStrategy.type
                },

                "financial_health_indicators": {
                    "savings_rate_assessment": savingsRate >= 20 ? "Excellent (20%+)" : savingsRate >= 15 ? "Good (15-20%)" : savingsRate >= 10 ? "Fair (10-15%)" : savingsRate > 0 ? "Low (<10%)" : "Deficit (negative savings)",
                    "emergency_fund_assessment": (() => {
                        const liquidCash = this.model.accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.balance, 0);
                        const monthsExpenses = totalExpenses > 0 ? liquidCash / (totalExpenses / 12) : 0;
                        return monthsExpenses >= 9 ? `Strong (${Math.round(monthsExpenses)} months)` :
                               monthsExpenses >= 6 ? `Adequate (${Math.round(monthsExpenses)} months)` :
                               monthsExpenses >= 3 ? `Minimal (${Math.round(monthsExpenses)} months)` :
                               `Insufficient (${Math.round(monthsExpenses)} months)`;
                    })(),
                    "retirement_readiness": (() => {
                        const yearsToRetirement = this.model.settings.household.personA.retirementYear - this.model.settings.planStartYear;
                        const retirementAge = this.model.settings.household.personA.retirementYear - this.model.settings.household.personA.birthYear;
                        if (yearsToRetirement <= 0) return "In retirement";
                        if (totalAssets > totalExpenses * 25) return "On track (25x+ expenses saved)";
                        if (totalAssets > totalExpenses * 15) return "Good progress (15-25x expenses)";
                        if (totalAssets > totalExpenses * 5) return "Early stages (5-15x expenses)";
                        return "Building phase (<5x expenses)";
                    })(),
                    "tax_optimization_status": this.model.accounts.filter(a => a.taxAdvantaged).reduce((sum, a) => sum + a.balance, 0) / totalAssets > 0.5 ? "Good (50%+ in tax-advantaged accounts)" : "Opportunity to improve"
                }
            },

            "_instructions_for_ai": {
                "overview": "You are reviewing a comprehensive personal financial plan. Your role is to act as a financial advisor and provide thoughtful, personalized recommendations. This plan includes detailed projections showing how their finances will evolve over the next " + this.model.settings.projectionHorizon + " years based on their current situation, planned income/expenses, investment returns, and withdrawal strategy.",
                "your_tasks": [
                    "Analyze the current financial situation and identify strengths and potential concerns",
                    "Evaluate whether assumptions (growth rates, investment returns, inflation) are realistic for the current economic environment",
                    "Check if expense categories are comprehensive - suggest any commonly overlooked expenses",
                    "Assess the investment glide path strategy and recommend adjustments based on age and risk tolerance",
                    "Review the withdrawal strategy for retirement sustainability",
                    "Identify opportunities to optimize savings, reduce expenses, or increase income",
                    "Flag any concerning trends in the 10-year projection",
                    "Suggest specific, actionable improvements with reasoning",
                    "Research current average costs for major expense categories (healthcare, housing, etc.) and compare to user's estimates",
                    "Validate that insurance, emergency fund, and tax planning are adequate"
                ],
                "response_format": "Provide a structured analysis with sections: Executive Summary, Strengths, Concerns, Detailed Recommendations (prioritized), Research Findings (current cost benchmarks), and Action Items",
                "tone": "Be supportive but honest. If something looks risky, say so clearly. Provide specific numbers and reasoning.",
                "important_notes": [
                    "All dollar amounts are in USD",
                    "Monthly amounts in income/expenses are multiplied by 12 for annual calculations",
                    "Investment returns are nominal (not inflation-adjusted)",
                    "Tax calculations use 2024 federal brackets only (no state taxes included)",
                    "The user's current age and retirement plans are in the 'settings' section"
                ]
            },

            "current_financial_snapshot": {
                "date": new Date().toLocaleDateString(),
                "total_assets": totalAssets,
                "annual_income": totalIncome,
                "annual_expenses": totalExpenses,
                "annual_savings": annualSavings,
                "savings_rate_percent": Math.round(savingsRate * 10) / 10,
                "analysis_notes": {
                    "savings_rate": savingsRate >= 20 ? "Excellent - above recommended 20%" :
                                   savingsRate >= 15 ? "Good - meeting minimum recommended 15%" :
                                   savingsRate >= 10 ? "Fair - below recommended 15-20%" :
                                   "Concerning - well below recommended minimum",
                    "asset_allocation": "See accounts section for breakdown by account type"
                }
            },

            "user_profile": {
                "plan_start_year": this.model.settings.planStartYear,
                "projection_horizon_years": this.model.settings.projectionHorizon,
                "tax_filing_status": this.model.settings.filingStatus,
                "tax_filing_status_note": this.model.settings.filingStatus === 'married'
                    ? "Married Filing Jointly - uses wider tax brackets (lower effective tax rate). First bracket: $23,200 @ 10%, top of 22% bracket: $201,050"
                    : "Single filer - uses narrower tax brackets (higher effective tax rate). First bracket: $11,600 @ 10%, top of 22% bracket: $100,525",
                "inflation_assumption_percent": this.model.settings.inflation,
                "household_composition": this.model.settings.household.personB ? "Couple" : "Single",

                "person_a": {
                    "name": this.model.settings.household.personA.name,
                    "current_age": this.model.settings.planStartYear - this.model.settings.household.personA.birthYear,
                    "retirement_year": this.model.settings.household.personA.retirementYear,
                    "retirement_age": this.model.settings.household.personA.retirementYear - this.model.settings.household.personA.birthYear,
                    "years_to_retirement": Math.max(0, this.model.settings.household.personA.retirementYear - this.model.settings.planStartYear),
                    "life_expectancy": this.model.settings.household.personA.lifeExpectancy,
                    "years_in_retirement": Math.max(0, this.model.settings.household.personA.lifeExpectancy - (this.model.settings.household.personA.retirementYear - this.model.settings.household.personA.birthYear)),
                    "social_security": this.model.settings.household.personA.socialSecurity && this.model.settings.household.personA.socialSecurity.enabled ? {
                        "annual_amount": this.model.settings.household.personA.socialSecurity.annualAmount,
                        "start_age": this.model.settings.household.personA.socialSecurity.startAge,
                        "start_year": this.model.settings.household.personA.birthYear + this.model.settings.household.personA.socialSecurity.startAge,
                        "monthly_amount": Math.round(this.model.settings.household.personA.socialSecurity.annualAmount / 12),
                        "_note": "Delaying Social Security past age 67 increases benefits by ~8%/year until age 70"
                    } : null
                },

                "person_b": this.model.settings.household.personB ? {
                    "name": this.model.settings.household.personB.name,
                    "current_age": this.model.settings.planStartYear - this.model.settings.household.personB.birthYear,
                    "retirement_year": this.model.settings.household.personB.retirementYear,
                    "retirement_age": this.model.settings.household.personB.retirementYear - this.model.settings.household.personB.birthYear,
                    "years_to_retirement": Math.max(0, this.model.settings.household.personB.retirementYear - this.model.settings.planStartYear),
                    "life_expectancy": this.model.settings.household.personB.lifeExpectancy,
                    "years_in_retirement": Math.max(0, this.model.settings.household.personB.lifeExpectancy - (this.model.settings.household.personB.retirementYear - this.model.settings.household.personB.birthYear)),
                    "social_security": this.model.settings.household.personB.socialSecurity && this.model.settings.household.personB.socialSecurity.enabled ? {
                        "annual_amount": this.model.settings.household.personB.socialSecurity.annualAmount,
                        "start_age": this.model.settings.household.personB.socialSecurity.startAge,
                        "start_year": this.model.settings.household.personB.birthYear + this.model.settings.household.personB.socialSecurity.startAge,
                        "monthly_amount": Math.round(this.model.settings.household.personB.socialSecurity.annualAmount / 12)
                    } : null
                } : null,

                "pension": this.model.settings.pension && this.model.settings.pension.enabled ? {
                    "name": this.model.settings.pension.name,
                    "owner": this.model.settings.pension.owner,
                    "annual_amount": this.model.settings.pension.annualAmount,
                    "start_year": this.model.settings.pension.startYear,
                    "annual_growth": this.model.settings.pension.growth,
                    "monthly_amount": Math.round(this.model.settings.pension.annualAmount / 12),
                    "_note": "Pension income included in annual projections starting from start_year"
                } : null,

                "derived_withdrawal_start_year": this.projectionEngine.getWithdrawalStartYear(),
                "withdrawal_start_calculation": this.model.withdrawalStrategy.autoWithdrawalStart ?
                    "Auto-calculated from earliest retirement year or when income < expenses" :
                    "User-specified explicit year: " + this.model.withdrawalStrategy.withdrawalStartYear,

                "_ai_guidance": {
                    "considerations": [
                        "Years to retirement affects risk tolerance - more time allows for aggressive investing",
                        "Years in retirement affects withdrawal strategy - longer retirement needs more conservative approach",
                        "Life expectancy is an assumption - recommend planning to age 95+ for safety",
                        "Verify inflation assumption is realistic (historical average: 3%, recent years: 3-4%)"
                    ]
                }
            },

            "accounts": {
                "data": this.model.accounts.map(acc => ({
                    ...acc,
                    "_notes": acc.type === 'cash' ? "Liquid cash (checking/savings) - low/no return, emergency fund" :
                             acc.type === 'taxable' ? "Taxable brokerage - subject to capital gains tax" :
                             acc.type === 'traditional' ? "Traditional 401k/IRA - tax-deferred, withdrawals taxed as income" :
                             acc.type === 'roth' ? "Roth 401k/IRA - after-tax contributions, tax-free withdrawals" :
                             acc.type === 'hsa' ? "Health Savings Account - triple tax advantaged" : ""
                })),
                "total_balance": totalAssets,
                "account_breakdown": {
                    "liquid_cash": this.model.accounts.filter(a => a.type === 'cash')
                                       .reduce((sum, a) => sum + a.balance, 0),
                    "investments": this.model.accounts.filter(a => ['taxable', 'traditional', 'roth', 'hsa'].includes(a.type))
                                       .reduce((sum, a) => sum + a.balance, 0)
                },

                "_ai_guidance": {
                    "emergency_fund_target": totalExpenses * 0.75, // 9 months of expenses
                    "questions_to_ask": [
                        "Does the user have adequate emergency funds (6-12 months expenses in liquid savings)?",
                        "Is too much cash sitting idle in low-yield accounts?",
                        "Are retirement accounts being maximized (401k limit: $23,000 in 2024, IRA: $7,000)?",
                        "Is the overall asset allocation appropriate for the user's age and risk tolerance?"
                    ]
                }
            },

            "income_sources": {
                "data": this.model.incomes.map(inc => ({
                    ...inc,
                    "annual_amount": inc.amount * (inc.frequency === 'monthly' ? 12 : 1),
                    "active_now": (!inc.startYear || currentYear >= inc.startYear) &&
                                 (!inc.endYear || currentYear <= inc.endYear),
                    "_notes": inc.category === 'salary' ? "Primary earned income - subject to income tax and FICA" :
                             inc.category === 'social_security' ? "Taxable at federal level, typically starts age 62-70" :
                             inc.category === 'pension' ? "Verify if defined benefit or annuity" :
                             inc.category === 'investment' ? "May include dividends, interest, capital gains" : ""
                })),
                "total_annual_income": totalIncome,

                "_ai_guidance": {
                    "questions_to_ask": [
                        "Is the salary growth rate realistic (typical: 2-4% including inflation)?",
                        "Has the user planned for Social Security? (Benefit calculators available at ssa.gov)",
                        "Are there opportunities for additional income streams?",
                        "Does income replacement in retirement match expected expenses?",
                        "Should the user consider delaying Social Security for higher benefits?"
                    ],
                    "research_tasks": [
                        "Look up current average Social Security benefits by age",
                        "Research typical pension payout options and tax implications",
                        "Verify dividend/interest income assumptions are realistic for portfolio size"
                    ]
                }
            },

            "expenses": {
                "data": this.model.expenses.map(exp => ({
                    ...exp,
                    "annual_amount": exp.amount * (exp.frequency === 'monthly' ? 12 : 1),
                    "active_now": (!exp.startYear || currentYear >= exp.startYear) &&
                                 (!exp.endYear || currentYear <= exp.endYear),
                    "_benchmark": exp.category === 'healthcare' ? "Average US healthcare: $12,000-15,000/year per person (age 65+)" :
                                 exp.category === 'housing' ? "Rent/mortgage should be <30% of gross income" :
                                 exp.category === 'transportation' ? "Average US: $10,000-12,000/year including car payment, insurance, gas" :
                                 exp.category === 'food' ? "Average US: $8,000-10,000/year per person" :
                                 "Compare to national averages"
                })),
                "total_annual_expenses": totalExpenses,
                "expense_breakdown_by_category": this.model.expenses.reduce((acc, exp) => {
                    const annual = exp.amount * (exp.frequency === 'monthly' ? 12 : 1);
                    const active = (!exp.startYear || currentYear >= exp.startYear) &&
                                  (!exp.endYear || currentYear <= exp.endYear);
                    if (active) {
                        acc[exp.category] = (acc[exp.category] || 0) + annual;
                    }
                    return acc;
                }, {}),

                "_ai_guidance": {
                    "commonly_forgotten_expenses": [
                        "Healthcare/Medicare premiums (age 65+: Part B ~$175/month, Part D ~$50/month, Supplemental ~$150/month)",
                        "Long-term care insurance ($3,000-7,000/year if purchased in 50s)",
                        "Home maintenance (1-2% of home value annually)",
                        "Property taxes (research local rates)",
                        "Auto insurance increases with age",
                        "Gifts/charity",
                        "Professional services (accountant, financial advisor)",
                        "Technology/subscriptions",
                        "Pet expenses",
                        "Travel/hobbies in retirement"
                    ],
                    "questions_to_ask": [
                        "Are growth rates appropriate? (Healthcare: 4-5%, Housing: 2-3%, Food: 2.5-3%, General: 2.5-3%)",
                        "Are there expenses that will end? (Mortgage payoff, kids' expenses, commuting costs at retirement)",
                        "Are there new expenses to plan for? (Medicare at 65, increased healthcare in old age)",
                        "Is the housing situation stable or will it change? (Downsizing, moving, long-term care)",
                        "Are insurance needs adequate? (Life, disability, umbrella, long-term care)"
                    ],
                    "research_tasks": [
                        "Look up current Medicare costs (Parts A, B, D, supplemental)",
                        "Research average long-term care costs in user's area",
                        "Find current average costs for major expense categories",
                        "Check if property tax or insurance rates are realistic for user's location"
                    ]
                }
            },

            "life_milestones": {
                "data": this.model.milestones.map(milestone => ({
                    ...milestone,
                    "years_from_now": milestone.year - currentYear,
                    "user_age_at_event": this.model.settings.currentAge + (milestone.year - currentYear),
                    "_notes": milestone.type === 'retirement' ? "Review retirement expenses vs income carefully" :
                             milestone.type === 'home' ? "Don't forget closing costs, moving, furnishing, increased utilities/maintenance" :
                             milestone.type === 'education' ? "Consider 529 plans, financial aid, student loans" :
                             milestone.type === 'travel' ? "Budget for increased travel in early retirement years" : ""
                })),

                "_ai_guidance": {
                    "questions_to_ask": [
                        "Are one-time costs realistic? (Home down payment typically 20% of purchase price, closing costs 2-5%)",
                        "Should recurring costs be added as separate expense items instead?",
                        "Are there major life events missing? (Car replacement, home renovation, family events)",
                        "Is retirement transition planned comprehensively? (Healthcare bridge until Medicare, lifestyle changes)"
                    ],
                    "research_tasks": [
                        "Look up average costs for planned milestones (wedding, home purchase, education)",
                        "Research typical retirement spending patterns (higher early years, decreases over time)"
                    ]
                }
            },

            "investment_strategy": {
                "glide_path": this.model.investmentGlidePath.map(period => ({
                    ...period,
                    "years_from_now": period.startYear - currentYear,
                    "user_age": this.model.settings.currentAge + (period.startYear - currentYear),
                    "_assessment": period.expectedReturn > 8 ? "Aggressive (typically 90-100% stocks)" :
                                  period.expectedReturn > 6 ? "Moderate (typically 60-70% stocks)" :
                                  period.expectedReturn > 4 ? "Conservative (typically 30-40% stocks)" :
                                  "Very Conservative (typically <20% stocks)",
                    "_volatility_note": period.volatility > 15 ? "High volatility - expect significant fluctuations" :
                                       period.volatility > 10 ? "Moderate volatility - typical for balanced portfolios" :
                                       "Low volatility - stable but lower growth potential"
                })),

                "_ai_guidance": {
                    "rule_of_thumb": "Traditional rule: Stock allocation = 110 - age (e.g., age 40 → 70% stocks)",
                    "modern_approach": "Many advisors now suggest 120 - age due to longer life expectancies",
                    "questions_to_ask": [
                        "Does the glide path appropriately de-risk as retirement approaches?",
                        "Are return expectations realistic? (Stocks historical: 10%, Bonds: 5%, 60/40 mix: 7-8%)",
                        "Is volatility appropriate for user's risk tolerance?",
                        "Should there be more gradual transitions between periods?",
                        "Is the user prepared emotionally for volatility? (2008 crash: -37%, 2020: -34%, 2022: -18%)"
                    ],
                    "research_tasks": [
                        "Look up current expected returns by asset class from major institutions (Vanguard, Schwab, etc.)",
                        "Research historical volatility of different stock/bond allocations",
                        "Find recommended glide paths for target-date funds as comparison"
                    ]
                }
            },

            "housing": {
                "rental_periods": this.model.housing.rentalPeriods.map(rental => ({
                    "name": rental.name,
                    "monthly_rent": rental.monthlyRent,
                    "annual_rent": rental.monthlyRent * 12,
                    "start_year": rental.startYear,
                    "end_year": rental.endYear || "ongoing",
                    "annual_increase_rate": rental.annualIncrease,
                    "security_deposit": rental.securityDeposit,
                    "_note": "Rent increases annually by annual_increase_rate"
                })),
                "owned_properties": this.model.housing.ownedProperties.map(prop => ({
                    "name": prop.name,
                    "purchase_year": prop.purchaseYear,
                    "purchase_price": prop.purchasePrice,
                    "down_payment": prop.downPayment,
                    "closing_costs": prop.closingCosts,
                    "loan_amount": prop.loanAmount,
                    "interest_rate": prop.interestRate,
                    "loan_term_years": prop.loanTermYears,
                    "monthly_mortgage_payment": Math.round(prop.monthlyPayment),
                    "annual_mortgage_payment": Math.round(prop.monthlyPayment * 12),
                    "property_tax_rate": prop.propertyTaxRate,
                    "annual_insurance": prop.insuranceAnnual,
                    "monthly_hoa": prop.hoaMonthly,
                    "annual_hoa": prop.hoaMonthly * 12,
                    "maintenance_rate": prop.maintenanceRate,
                    "appreciation_rate": prop.appreciationRate,
                    "extra_payment_monthly": prop.extraPaymentMonthly,
                    "sell_year": prop.sellYear,
                    "selling_costs_percent": prop.sellingCosts,
                    "_annual_costs_breakdown": {
                        "mortgage": Math.round(prop.monthlyPayment * 12),
                        "property_tax": Math.round(prop.purchasePrice * (prop.propertyTaxRate / 100)) + " (first year, increases with home value)",
                        "insurance": prop.insuranceAnnual,
                        "hoa": prop.hoaMonthly * 12,
                        "maintenance": Math.round(prop.purchasePrice * (prop.maintenanceRate / 100)) + " (first year, increases with home value)",
                        "total_first_year": Math.round(prop.monthlyPayment * 12 + prop.purchasePrice * (prop.propertyTaxRate / 100) + prop.insuranceAnnual + prop.hoaMonthly * 12 + prop.purchasePrice * (prop.maintenanceRate / 100))
                    }
                })),
                "_ai_guidance": {
                    "questions_to_ask": [
                        "Are property tax and maintenance costs realistic? (Typical: property tax 1-2% of value, maintenance 1-2% of value)",
                        "Is home insurance adequate? (Typical: $1,000-2,000/year depending on location and home value)",
                        "Does the user have an emergency fund for major home repairs?",
                        "Is the user house-rich but cash-poor? (High home equity but low liquid assets)",
                        "Should the user consider downsizing in retirement to unlock equity?",
                        "Are HOA fees expected to increase over time?",
                        "Is the home appreciation rate realistic for the area? (National average: 3-4%)"
                    ],
                    "benchmarks": {
                        "property_tax": "National average: 1.1% of home value annually (varies widely by state: NJ 2.5%, HI 0.3%)",
                        "home_insurance": "National average: $1,500-2,000/year (higher in disaster-prone areas)",
                        "maintenance": "Rule of thumb: 1-2% of home value annually for maintenance/repairs",
                        "hoa_fees": "Typical range: $200-400/month (can be much higher for luxury condos)",
                        "appreciation": "Historical US average: 3-4% annually (highly location-dependent)"
                    }
                }
            },

            "withdrawal_strategy": {
                "data": this.model.withdrawalStrategy,
                "strategy_explanation": this.model.withdrawalStrategy.type === 'fixed_percentage' ?
                    "4% Rule: Withdraw 4% of portfolio in year 1, then adjust for inflation. Historically safe for 30-year retirement." :
                    this.model.withdrawalStrategy.type === 'fixed_amount' ?
                    "Fixed Dollar: Withdraw same amount each year, adjusted for inflation. Simple but doesn't adapt to market performance." :
                    this.model.withdrawalStrategy.type === 'dynamic' ?
                    "Dynamic (Guyton-Klinger): Adjusts spending based on portfolio performance. More flexible than 4% rule." :
                    "RMDs: Required Minimum Distributions from retirement accounts starting age 73.",
                "withdrawal_mode_explanation": this.model.withdrawalStrategy.withdrawalMode === 'always' ?
                    "ALWAYS mode: Withdrawals apply starting from withdrawal_start_year regardless of surplus/deficit. Strategic withdrawals occur even if income > expenses." :
                    "DEFICIT_ONLY mode: Withdrawals only occur when income < expenses. More conservative - lets portfolio grow longer during surplus years.",

                "_ai_guidance": {
                    "questions_to_ask": [
                        "Is the withdrawal rate sustainable? (4% is considered safe, 5%+ is risky)",
                        "Should the strategy change based on market conditions?",
                        "Are RMDs from retirement accounts properly planned for?",
                        "Is there a plan for unexpected expenses (healthcare, home repairs)?",
                        "How will withdrawals be tax-optimized? (Roth vs traditional IRA, capital gains strategy)"
                    ],
                    "success_rates": {
                        "4_percent": "Historical success rate: 95% for 30-year retirement",
                        "5_percent": "Historical success rate: 75-80% for 30-year retirement",
                        "3_percent": "Historical success rate: 99%+ for 30-year retirement"
                    },
                    "research_tasks": [
                        "Look up current safe withdrawal rate research (Trinity Study updates)",
                        "Research tax-efficient withdrawal strategies",
                        "Find current RMD tables and calculate required withdrawals"
                    ]
                }
            },

            "10_year_projection": {
                "note": "Detailed year-by-year projection with balance reconciliation. Each year: end_balance = start_balance + contributions + windfall_contributions - withdrawals + investment_returns. NOTE: contributions = income - TAXES - expenses (after-tax savings), windfall_contributions = one-time windfalls from milestones (inheritance, bonuses, etc.)",
                "years": projections.map(p => {
                    const personAAge = this.model.settings.planStartYear - this.model.settings.household.personA.birthYear + (p.year - this.model.settings.planStartYear);
                    // Calculate effective tax rate using total taxable income (income + traditional withdrawals + tax bombs)
                    // NOT just "income" which could be near zero in retirement
                    const totalTaxableIncome = p.income + (p.traditionalWithdrawals || 0) + (p.milestoneTaxableIncome || 0) + (p.debtTaxableIncome || 0);
                    const effectiveTaxRate = totalTaxableIncome > 0 ? ((p.taxes || 0) / totalTaxableIncome * 100) : 0;
                    return {
                        year: p.year,
                        person_a_age: personAAge,
                        start_balance: Math.round(p.startBalance),
                        contributions: Math.round(p.contributions),
                        windfall_contributions: Math.round(p.windfallContributions || 0),
                        withdrawals: Math.round(p.withdrawals),
                        withdrawal_shortfall: Math.round(p.withdrawalShortfall || 0),
                        investment_returns: Math.round(p.investmentReturns),
                        end_balance: Math.round(p.endBalance),
                        income: Math.round(p.income),
                        taxes: Math.round(p.taxes || 0),
                        effective_tax_rate: Math.round(effectiveTaxRate * 10) / 10,
                        expenses: Math.round(p.expenses),
                        housing_costs_breakdown: {
                            rent: Math.round(p.rentCost || 0),
                            mortgage: Math.round(p.mortgageCost || 0),
                            property_tax: Math.round(p.propertyTaxCost || 0),
                            insurance: Math.round(p.insuranceCost || 0),
                            hoa: Math.round(p.hoaCost || 0),
                            maintenance: Math.round(p.maintenanceCost || 0),
                            total_housing: Math.round(p.housingCosts || 0)
                        },
                        home_equity: Math.round(p.homeEquity || 0),
                        net_cash_flow: Math.round(p.netCashFlow),
                        milestone_costs: Math.round(p.milestoneCosts || 0),
                        milestone_windfalls: Math.round(p.milestoneWindfalls || 0),
                        _reconciliation_check: Math.round(p.startBalance + p.contributions + (p.windfallContributions || 0) - p.withdrawals + p.investmentReturns) === Math.round(p.endBalance) ? "✓ Pass" : "✗ FAIL"
                    };
                }),
                "trend_analysis": {
                    "starting_net_worth": Math.round(projections[0].endBalance),
                    "ending_net_worth": Math.round(projections[projections.length - 1].endBalance),
                    "total_change": Math.round(projections[projections.length - 1].endBalance - projections[0].endBalance),
                    "percent_change": Math.round((projections[projections.length - 1].endBalance / projections[0].endBalance - 1) * 100),
                    "total_income": Math.round(projections.reduce((sum, p) => sum + p.income, 0)),
                    "total_taxes": Math.round(projections.reduce((sum, p) => sum + (p.taxes || 0), 0)),
                    "total_expenses": Math.round(projections.reduce((sum, p) => sum + p.expenses, 0)),
                    "total_contributions": Math.round(projections.reduce((sum, p) => sum + p.contributions, 0)),
                    "total_windfalls": Math.round(projections.reduce((sum, p) => sum + (p.windfallContributions || 0), 0)),
                    "total_withdrawals": Math.round(projections.reduce((sum, p) => sum + p.withdrawals, 0)),
                    "total_investment_returns": Math.round(projections.reduce((sum, p) => sum + p.investmentReturns, 0)),
                    "years_with_shortfall": projections.filter(p => (p.withdrawalShortfall || 0) > 0).length,
                    "first_shortfall_year": projections.find(p => (p.withdrawalShortfall || 0) > 0)?.year || null,
                    "average_effective_tax_rate": (() => {
                        const totalIncome = projections.reduce((sum, p) => sum + p.income, 0);
                        const totalTaxes = projections.reduce((sum, p) => sum + (p.taxes || 0), 0);
                        return totalIncome > 0 ? Math.round((totalTaxes / totalIncome) * 1000) / 10 : 0;
                    })(),
                    "savings_rate": (() => {
                        const totalIncome = projections.reduce((sum, p) => sum + p.income, 0);
                        const totalContributions = projections.reduce((sum, p) => sum + p.contributions, 0);
                        return totalIncome > 0 ? Math.round((totalContributions / totalIncome) * 100) : 0;
                    })()
                },

                "_ai_guidance": {
                    "red_flags": [
                        "Net worth declining over time (except in early retirement)",
                        "withdrawal_shortfall > 0 in any year (means portfolio exhausted)",
                        "Withdrawals exceeding investment returns consistently (unsustainable)",
                        "end_balance approaching zero before life expectancy",
                        "Large milestone expenses causing significant net worth drops",
                        "_reconciliation_check showing FAIL (calculation error - report this)"
                    ],
                    "questions_to_ask": [
                        "Is the trajectory sustainable?",
                        "Are withdrawal amounts realistic given portfolio size?",
                        "Are there concerning dips or plateaus?",
                        "Does the plan survive to life expectancy?",
                        "Should savings rate be increased to build larger portfolio?",
                        "Are investment return assumptions realistic?"
                    ],
                    "how_to_read": {
                        "start_balance": "Portfolio value at beginning of year",
                        "income": "Gross income before taxes (salary + retirement income + pensions)",
                        "taxes": "Federal income taxes calculated based on filing status (single vs married filing jointly). Uses 2024 tax brackets.",
                        "effective_tax_rate": "Actual tax rate paid as percentage of total taxable income (taxes / (income + traditional_withdrawals + tax_bombs) * 100). More accurate than income-only in retirement.",
                        "expenses": "Annual living expenses",
                        "contributions": "After-tax savings = income - TAXES - expenses (excludes windfalls). This is the TRUE savings rate.",
                        "windfall_contributions": "One-time windfalls (inheritance, bonuses, home sale proceeds). Separated so savings rate remains meaningful.",
                        "withdrawals": "Money taken out - either to cover deficits or strategic withdrawals per strategy",
                        "investment_returns": "Growth from investments (stock/bond returns)",
                        "end_balance": "Portfolio value at end of year = start + contributions + windfalls - withdrawals + returns",
                        "net_cash_flow": "income - TAXES - expenses + windfalls - milestone costs (after-tax cash flow)",
                        "withdrawal_shortfall": "If > 0, needed to withdraw more than portfolio had (BAD - ran out of money)",
                        "savings_rate": "Calculated as total_contributions / total_income (after-tax savings rate, excludes windfalls)",
                        "average_effective_tax_rate": "Average percentage of income paid in taxes over the entire projection period"
                    }
                }
            },

            "validation_status": (() => {
                const validation = this.model.validate();
                return {
                    "is_valid": validation.valid,
                    "errors": validation.errors.map(e => ({
                        message: e.message,
                        field: e.field,
                        severity: "ERROR - Must be fixed"
                    })),
                    "warnings": validation.warnings.map(w => ({
                        message: w.message,
                        field: w.field,
                        severity: "WARNING - Review recommended"
                    })),
                    "_ai_note": validation.errors.length > 0 ?
                        "CRITICAL: This plan has validation errors that must be fixed before projections can be trusted. Address these first in your analysis." :
                        validation.warnings.length > 0 ?
                        "This plan has warnings - review them and mention in your analysis if they could impact the plan's viability." :
                        "Plan passes all validation checks."
                };
            })(),

            "_scenario_template_guide": {
                "purpose": "After analyzing the user's financial plan, you can suggest new scenarios they can test. Export scenarios as JSON files that they can upload back into the tool.",
                "how_to_create_scenarios": "Generate a JSON file following the template below, then instruct the user to save it and upload it via the 'Scenarios' tab in the tool",

                "scenario_template": {
                    "name": "Descriptive Scenario Name (e.g., 'Early Retirement at 55', 'House Purchase in 2028')",
                    "description": "Detailed explanation of what this scenario tests and why it's relevant",
                    "data": {
                        "accounts": [
                            {
                                "id": 1234567890,
                                "name": "Account Name",
                                "type": "traditional|roth|taxable|cash|hsa",
                                "balance": 100000,
                                "interestRate": 7.0,
                                "taxAdvantaged": true
                            }
                        ],
                        "incomes": [
                            {
                                "id": 1234567890,
                                "name": "Income Source Name",
                                "category": "salary|business|investment|rental|pension|social_security|freelance|other",
                                "amount": 5000,
                                "frequency": "monthly|annual",
                                "startYear": 2025,
                                "endYear": 2050,
                                "growth": 3.0,
                                "ownerId": "personA|personB|household"
                            }
                        ],
                        "expenses": [
                            {
                                "id": 1234567890,
                                "name": "Expense Name",
                                "category": "housing|transportation|food|healthcare|entertainment|insurance|utilities|other",
                                "amount": 2000,
                                "frequency": "monthly|annual",
                                "startYear": 2025,
                                "endYear": null,
                                "growth": 3.0
                            }
                        ],
                        "milestones": [
                            {
                                "id": 1234567890,
                                "name": "Milestone Name",
                                "type": "retirement|home|education|travel|other",
                                "year": 2030,
                                "cost": 50000,
                                "isPositive": false,
                                "recurring": false,
                                "recurringAmount": 0
                            }
                        ],
                        "settings": {
                            "planStartYear": 2025,
                            "projectionHorizon": 40,
                            "inflation": 3.0,
                            "filingStatus": "single|married",
                            "household": {
                                "personA": {
                                    "name": "Person Name",
                                    "birthYear": 1985,
                                    "retirementYear": 2050,
                                    "lifeExpectancy": 90,
                                    "socialSecurity": {
                                        "enabled": true,
                                        "annualAmount": 24000,
                                        "startAge": 67
                                    }
                                },
                                "personB": null
                            },
                            "pension": {
                                "enabled": false,
                                "owner": "personA",
                                "name": "",
                                "annualAmount": 0,
                                "startYear": 2050,
                                "growth": 0
                            }
                        },
                        "investmentGlidePath": [
                            {
                                "startYear": 2025,
                                "expectedReturn": 8.0,
                                "volatility": 18
                            }
                        ],
                        "withdrawalStrategy": {
                            "type": "fixed_percentage|fixed_amount|dynamic|rmd",
                            "withdrawalPercentage": 4.0,
                            "fixedAmount": 40000,
                            "inflationAdjusted": true,
                            "withdrawalMode": "always|deficit_only",
                            "withdrawalStartYear": null,
                            "autoWithdrawalStart": true
                        }
                    }
                },

                "example_scenario_suggestions": [
                    "Early Retirement: Modify retirement year to be 5 years earlier, adjust expenses for healthcare before Medicare",
                    "Home Purchase: Add a milestone for down payment, increase housing expenses, adjust savings rate",
                    "Career Change: Reduce income for 2-3 years, add education expenses, then increase income with new skills",
                    "Conservative Portfolio: Lower expected returns by 1-2%, increase cash allocation",
                    "Aggressive Savings: Increase savings rate by 10%, show impact on retirement date",
                    "Medical Emergency: Add one-time $50k expense, test portfolio resilience",
                    "Inheritance: Add windfall milestone, show optimal allocation strategy"
                ],

                "instructions_for_creating_scenarios": [
                    "1. Copy the user's current data from this export as your starting point",
                    "2. Modify ONLY the specific fields relevant to your scenario (don't change unrelated data)",
                    "3. Use realistic numbers based on your research (e.g., actual healthcare costs, realistic home prices)",
                    "4. Generate unique IDs for any new items using Date.now() format (e.g., 1709251234567)",
                    "5. Provide clear description explaining what changed and why this scenario matters",
                    "6. Format as valid JSON that can be directly uploaded to the tool",
                    "7. Give the user instructions: 'Save this as scenario-name.json, then go to Scenarios tab and click Upload Scenario'"
                ],

                "important_notes": [
                    "Scenarios are complete snapshots - they include ALL financial data, not just changes",
                    "Users can compare scenarios side-by-side in the tool's Scenarios tab",
                    "Start with user's current data and modify specific elements to test 'what if' questions",
                    "Be conservative in assumptions - it's better to under-promise and over-deliver",
                    "Account IDs, income IDs, etc. should be unique numbers (use timestamps)",
                    "Setting endYear to null means 'continue indefinitely'",
                    "growth rates are annual percentages (e.g., 3.0 = 3% per year)"
                ]
            },

            "_final_ai_instructions": {
                "be_thorough": "Review every section carefully. Users rely on this for major life decisions.",
                "be_specific": "Don't just say 'increase savings' - suggest exact amounts and where to cut",
                "be_realistic": "If something looks risky or unrealistic, say so clearly with data",
                "do_research": "Look up current costs, rates, and benchmarks. Don't guess.",
                "prioritize": "Rank recommendations by impact and urgency",
                "explain_reasoning": "Show your work - why are you making each suggestion?",
                "be_encouraging": "Financial planning is hard. Acknowledge what the user is doing well.",
                "provide_action_items": "End with a clear, numbered list of specific next steps",
                "check_validation_first": "ALWAYS start by reviewing the validation_status section - if there are errors, those must be your top priority recommendations",
                "offer_scenarios": "After your analysis, ask if the user would like you to generate specific scenario files they can upload to test different strategies"
            },

            "_csv_export_instructions_for_ai": {
                "purpose": "If the user asks you to export their data as CSV, or if you want to provide them with a modified/optimized version of their plan that they can import back into the tool, use these instructions to generate a properly formatted CSV file.",

                "CRITICAL_DO_NOT_EXPORT_CODE": "When the user asks for CSV format, provide ONLY CSV data in the format specified below. DO NOT provide JavaScript code, JSON, or any other format. The CSV should look like the complete_csv_example section below - starting with [SETTINGS] and containing only comma-separated values.",

                "important_notes": [
                    "The CSV format is section-based with [SECTION_NAME] headers",
                    "Each section has a header row with column names, followed by data rows",
                    "Blank lines separate sections",
                    "The user can open this CSV in Excel or any text editor to make manual changes",
                    "The tool can import this CSV to load/update their financial plan",
                    "Values containing commas or quotes should be wrapped in double quotes",
                    "Null/empty values for optional fields should be left blank"
                ],

                "csv_format_specification": {
                    "overview": "Generate a text file with the following structure. Each section starts with [SECTION] on its own line, followed by a header row, then data rows. Separate sections with blank lines.",

                    "required_sections_in_order": [
                        "[SETTINGS] - Basic plan configuration",
                        "[PERSON_A] - Primary person details",
                        "[PERSON_B] - Optional second person (omit section if single)",
                        "[ACCOUNTS] - Investment/savings accounts",
                        "[INCOMES] - Income sources",
                        "[EXPENSES] - Ongoing expenses",
                        "[HOUSING_RENTAL] or [HOUSING_OWNED] - Housing details (optional)",
                        "[CREDIT_CARDS] - Credit card debts (optional)",
                        "[LOANS] - Other loans (optional)",
                        "[MILESTONES] - One-time events (optional)",
                        "[INVESTMENT_GLIDE_PATH] - Return expectations over time",
                        "[WITHDRAWAL_STRATEGY] - Retirement withdrawal configuration"
                    ]
                },

                "section_formats": {
                    "SETTINGS": {
                        "header": "PlanStartYear,ProjectionHorizon,Inflation,FilingStatus",
                        "example": "2026,45,3.0,married",
                        "notes": "FilingStatus: 'single' or 'married'"
                    },

                    "PERSON_A": {
                        "header": "Name,BirthYear,RetirementYear,LifeExpectancy,SS_Enabled,SS_Amount,SS_StartAge",
                        "example": "John,1980,2045,95,true,30000,70",
                        "notes": "SS_Enabled: true/false. SS_Amount: annual Social Security benefit. SS_StartAge: 62-70 typical"
                    },

                    "PERSON_B": {
                        "header": "Name,BirthYear,RetirementYear,LifeExpectancy,SS_Enabled,SS_Amount,SS_StartAge",
                        "example": "Jane,1982,2047,95,true,28000,67",
                        "notes": "Omit entire section if single person plan"
                    },

                    "ACCOUNTS": {
                        "header": "Name,Type,Balance,InterestRate",
                        "example": "401k,traditional,250000,7.0",
                        "notes": "Type: cash, taxable, traditional, roth, or hsa. InterestRate: expected annual return %"
                    },

                    "INCOMES": {
                        "header": "Name,Amount,Frequency,StartYear,EndYear,Category,Growth",
                        "example": "Salary,8000,monthly,2026,2045,salary,3.0",
                        "notes": "Frequency: monthly or annual. EndYear: blank for ongoing. Category: salary, business, investment, rental, pension, social_security, freelance, other. Growth: annual increase %"
                    },

                    "EXPENSES": {
                        "header": "Name,Amount,Frequency,StartYear,EndYear,Category,Growth",
                        "example": "Groceries,800,monthly,2026,,food,3.0",
                        "notes": "Same format as INCOMES. EndYear blank = ongoing. Category: housing, transportation, food, healthcare, entertainment, insurance, utilities, other"
                    },

                    "HOUSING_RENTAL": {
                        "header": "MonthlyRent,AnnualIncrease,StartYear",
                        "example": "2000,3.0,2026",
                        "notes": "Only include if renting. Omit if owning home."
                    },

                    "HOUSING_OWNED": {
                        "header": "Name,PurchaseYear,PurchasePrice,DownPayment,InterestRate,LoanTermYears,PropertyTaxRate,InsuranceAnnual,HOA_Monthly,MaintenanceRate,AppreciationRate",
                        "example": "Primary Home,2020,400000,80000,6.5,30,1.2,1500,0,1.0,3.0",
                        "notes": "Only include if owning. PropertyTaxRate/MaintenanceRate/AppreciationRate are annual percentages. Can have multiple properties (multiple rows)."
                    },

                    "CREDIT_CARDS": {
                        "header": "Name,Balance,APR,MinimumPaymentPercent,ExtraPayment",
                        "example": "Chase Card,5000,18.0,2.0,100",
                        "notes": "Optional section. MinimumPaymentPercent: typical 2-3%. ExtraPayment: additional monthly payment"
                    },

                    "LOANS": {
                        "header": "Name,Type,Balance,InterestRate,MonthlyPayment,StartYear,TermYears",
                        "example": "Auto Loan,auto,25000,5.0,472,2024,5",
                        "notes": "Optional section. Type: auto, student, personal, other"
                    },

                    "MILESTONES": {
                        "header": "Year,Name,Type,Cost,IsPositive,Recurring,RecurringAmount,RecurringInterval,RecurringGrowth",
                        "example": "2030,New Car,other,35000,false,true,40000,8,5.0",
                        "notes": "Optional section. Type: retirement, home, education, travel, other. IsPositive: false=expense, true=windfall. Recurring: true if repeats. RecurringInterval: years between recurrences"
                    },

                    "INVESTMENT_GLIDE_PATH": {
                        "header": "StartYear,ExpectedReturn,Volatility",
                        "example_rows": [
                            "2026,8.0,18",
                            "2035,6.0,12",
                            "2050,4.0,6"
                        ],
                        "notes": "Define investment return expectations over time. Typical: aggressive (8-10%) early, conservative (4-5%) late. Volatility is standard deviation."
                    },

                    "WITHDRAWAL_STRATEGY": {
                        "header": "Type,WithdrawalPercentage,InflationAdjusted,FixedAmount,RMD_StartAge,WithdrawalStartYear,WithdrawalMode",
                        "example": "fixed_percentage,4.0,true,0,73,,as_needed",
                        "notes": "Type: fixed_percentage (4% rule), fixed_amount, dynamic, rmd. WithdrawalMode: as_needed (only withdraw when needed) or always (strategic withdrawals even with surplus). WithdrawalStartYear: leave blank for auto-detection"
                    }
                },

                "complete_csv_example": `[SETTINGS]
PlanStartYear,ProjectionHorizon,Inflation,FilingStatus
2026,45,3.0,married

[PERSON_A]
Name,BirthYear,RetirementYear,LifeExpectancy,SS_Enabled,SS_Amount,SS_StartAge
John,1980,2045,95,true,30000,70

[PERSON_B]
Name,BirthYear,RetirementYear,LifeExpectancy,SS_Enabled,SS_Amount,SS_StartAge
Jane,1982,2047,95,true,28000,67

[ACCOUNTS]
Name,Type,Balance,InterestRate
401k,traditional,250000,7.0
Roth IRA,roth,80000,7.0
Brokerage,taxable,120000,7.0
Savings,cash,50000,3.5

[INCOMES]
Name,Amount,Frequency,StartYear,EndYear,Category,Growth
John Salary,8000,monthly,2026,2045,salary,3.0
Jane Salary,7000,monthly,2026,2047,salary,3.0

[EXPENSES]
Name,Amount,Frequency,StartYear,EndYear,Category,Growth
Groceries,800,monthly,2026,,food,3.0
Healthcare,500,monthly,2026,2044,healthcare,5.0
Healthcare Medicare,400,monthly,2045,,healthcare,4.0
Travel,15000,annual,2026,,entertainment,3.0

[MILESTONES]
Year,Name,Type,Cost,IsPositive,Recurring,RecurringAmount,RecurringInterval,RecurringGrowth
2030,New Car,other,35000,false,true,40000,8,5.0

[INVESTMENT_GLIDE_PATH]
StartYear,ExpectedReturn,Volatility
2026,8.0,18
2035,6.0,12
2050,4.0,6

[WITHDRAWAL_STRATEGY]
Type,WithdrawalPercentage,InflationAdjusted,FixedAmount,RMD_StartAge,WithdrawalStartYear,WithdrawalMode
fixed_percentage,4.0,true,0,73,,as_needed`,

                "how_to_generate_csv_for_user": [
                    "1. Extract the relevant data from the JSON sections above (accounts, incomes, expenses, etc.)",
                    "2. Format it according to the CSV specification with proper section headers",
                    "3. Ensure all required sections are included in the correct order",
                    "4. Include optional sections (housing, debts, milestones) only if the user has data for them",
                    "5. Use blank values for optional fields (e.g., EndYear for ongoing expenses)",
                    "6. CRITICAL: Present ONLY the CSV data in a plain text code block - NO explanations, NO code, NO JSON - just the CSV format shown in the example",
                    "7. The CSV should start with [SETTINGS] and follow the exact format in complete_csv_example above",
                    "8. Instruct the user to save it as a .csv file and use the Import button in the tool"
                ],

                "when_to_provide_csv": [
                    "User explicitly asks for a CSV export",
                    "User asks you to 'optimize' or 'improve' their plan and wants to import the changes",
                    "You suggest modifications and user wants them in importable format",
                    "User wants to create a scenario variation they can test"
                ],

                "csv_output_format": "When providing CSV to the user, output it in a plain text code block starting with ```csv and ending with ```. The content should be EXACTLY like the complete_csv_example above - it should start with [SETTINGS] on the first line, NOT with JavaScript code, NOT with JSON, and NOT with any other format.",

                "user_instructions_template": "Save this as a .csv file (e.g., 'financial-plan.csv'), then in the Financial Projection Tool, click Settings → Import Data → Import CSV File and select your saved file. The tool will load all your data automatically."
            }
        };

        // Download the AI-readable export
        const blob = new Blob([JSON.stringify(aiReadableExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-plan-AI-review-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        // Show success message
        alert('AI-readable export created! Upload this file to Claude, ChatGPT, or another AI assistant and ask them to review your financial plan. The file includes detailed instructions for comprehensive analysis and specific research tasks.');
    }

    updateTaxProjections() {
        const projections = this.projectionEngine.projectNetWorth(40); // Full 40-year projection
        const filingStatus = this.model.settings.filingStatus;

        // Update filing status display
        const statusDisplay = {
            'single': 'Single',
            'married': 'Married Filing Jointly',
            'hoh': 'Head of Household'
        };
        const statusElement = document.getElementById('currentFilingStatus');
        if (statusElement) {
            statusElement.textContent = statusDisplay[filingStatus] || filingStatus;
        }

        const taxData = projections.map(p => {
            const earnedIncome = p.income;
            const traditionalWithdrawals = p.traditionalWithdrawals || 0;
            const milestoneTaxBombs = p.milestoneTaxableIncome || 0;
            const debtTaxBombs = p.debtTaxableIncome || 0;
            const totalTaxableIncome = earnedIncome + traditionalWithdrawals + milestoneTaxBombs + debtTaxBombs;

            return {
                year: p.year,
                earnedIncome: earnedIncome,
                withdrawals: p.withdrawals || 0,
                traditionalWithdrawals: traditionalWithdrawals,
                milestoneTaxableIncome: milestoneTaxBombs,
                debtTaxableIncome: debtTaxBombs,
                totalTaxableIncome: totalTaxableIncome,
                tax: p.taxes,
                effectiveRate: totalTaxableIncome > 0 ? (p.taxes / totalTaxableIncome) * 100 : 0
            };
        });

        // Update chart
        const ctx = document.getElementById('taxChart').getContext('2d');
        if (this.charts.tax) {
            this.charts.tax.destroy();
        }

        this.charts.tax = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: taxData.map(d => d.year),
                datasets: [{
                    label: 'Federal Taxes',
                    data: taxData.map(d => d.tax),
                    backgroundColor: '#ef4444',
                    borderColor: '#dc2626',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const dataPoint = taxData[context.dataIndex];
                                return [
                                    `Taxes: $${context.parsed.y.toLocaleString()}`,
                                    `Earned Income: $${dataPoint.earnedIncome.toLocaleString()}`,
                                    `Traditional Withdrawals: $${dataPoint.traditionalWithdrawals.toLocaleString()}`,
                                    `Tax Bombs: $${(dataPoint.milestoneTaxableIncome + dataPoint.debtTaxableIncome).toLocaleString()}`,
                                    `Total Taxable: $${dataPoint.totalTaxableIncome.toLocaleString()}`,
                                    `Effective Rate: ${dataPoint.effectiveRate.toFixed(1)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                }
            }
        });

        // Update table
        document.getElementById('taxProjections').innerHTML = `
            <h3 style="margin-top: 30px; margin-bottom: 15px;">Detailed Tax Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 12px; text-align: left;">Year</th>
                        <th style="padding: 12px; text-align: right;">Earned Income</th>
                        <th style="padding: 12px; text-align: right;">Traditional Withdrawals</th>
                        <th style="padding: 12px; text-align: right;">Tax Bombs 💣</th>
                        <th style="padding: 12px; text-align: right;">Total Taxes</th>
                        <th style="padding: 12px; text-align: right;">Effective Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${taxData.map(d => {
                        const totalTaxBombs = d.milestoneTaxableIncome + d.debtTaxableIncome;
                        return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${d.year}</td>
                            <td style="padding: 12px; text-align: right;">$${d.earnedIncome.toLocaleString()}</td>
                            <td style="padding: 12px; text-align: right;">$${d.traditionalWithdrawals.toLocaleString()}</td>
                            <td style="padding: 12px; text-align: right;">
                                ${totalTaxBombs > 0 ?
                                    `<span style="color: var(--danger); font-weight: 600;">$${totalTaxBombs.toLocaleString()} 💣</span>` :
                                    '$0'}
                            </td>
                            <td style="padding: 12px; text-align: right; color: #ef4444;">$${d.tax.toLocaleString()}</td>
                            <td style="padding: 12px; text-align: right;">${d.effectiveRate.toFixed(1)}%</td>
                        </tr>
                    `;}).join('')}
                </tbody>
            </table>
        `;
    }

    toggleWithdrawalSettings(strategyType) {
        // Hide all strategy-specific settings
        document.getElementById('fixedPercentageSettings').style.display = 'none';
        document.getElementById('fixedAmountSettings').style.display = 'none';
        document.getElementById('dynamicSettings').style.display = 'none';
        document.getElementById('rmdSettings').style.display = 'none';

        // Show the selected strategy's settings
        switch(strategyType) {
            case 'fixed_percentage':
                document.getElementById('fixedPercentageSettings').style.display = 'block';
                break;
            case 'fixed_amount':
                document.getElementById('fixedAmountSettings').style.display = 'block';
                break;
            case 'dynamic':
                document.getElementById('dynamicSettings').style.display = 'block';
                break;
            case 'rmd':
                document.getElementById('rmdSettings').style.display = 'block';
                break;
        }
    }

    saveWithdrawalStrategy() {
        const strategy = document.getElementById('withdrawalStrategy').value;
        const selectedMode = document.querySelector('input[name="withdrawalMode"]:checked');

        this.model.withdrawalStrategy = {
            type: strategy,
            withdrawalPercentage: parseFloat(document.getElementById('withdrawalPercentage').value),
            inflationAdjusted: document.getElementById('inflationAdjusted').checked,
            fixedAmount: parseFloat(document.getElementById('fixedWithdrawalAmount').value),
            fixedInflationAdjusted: document.getElementById('fixedInflationAdjusted').checked,
            dynamicInitialRate: parseFloat(document.getElementById('dynamicInitialRate').value),
            dynamicUpperGuardrail: parseFloat(document.getElementById('dynamicUpperGuardrail').value),
            dynamicLowerGuardrail: parseFloat(document.getElementById('dynamicLowerGuardrail').value),
            rmdStartAge: parseInt(document.getElementById('rmdStartAge').value),
            withdrawalStartYear: parseInt(document.getElementById('withdrawalStartYear').value),
            withdrawalMode: selectedMode ? selectedMode.value : 'always',
            autoWithdrawalStart: this.model.withdrawalStrategy.autoWithdrawalStart
        };

        this.saveData();
        this.updateDashboard();
        alert('✓ Withdrawal strategy saved!');
    }

    saveScenario() {
        const scenarioName = prompt('Enter a name for this scenario:', `Scenario ${this.scenarios.length + 1}`);
        if (!scenarioName) return;

        const scenario = {
            id: Date.now(),
            name: scenarioName,
            date: new Date().toISOString(),
            data: this.getCurrentPlanData()
        };

        this.scenarios.push(scenario);
        this.saveData();
        this.updateScenariosList();
        alert(`✓ Scenario "${scenarioName}" saved!`);
    }

    updateCurrentScenario() {
        if (!this.currentScenarioId) {
            alert('No scenario is currently loaded');
            return;
        }

        const scenario = this.scenarios.find(s => s.id === this.currentScenarioId);
        if (!scenario) {
            alert('Current scenario not found');
            return;
        }

        if (confirm(`Update "${scenario.name}" with current changes?`)) {
            // Update the scenario data with current working data
            scenario.data = this.getCurrentPlanData();
            scenario.date = new Date().toISOString(); // Update timestamp

            this.saveData();
            this.updateScenariosList();
            alert(`✓ Scenario "${scenario.name}" updated!`);
        }
    }

    compareScenario(scenarioId) {
        const compareToScenario = this.scenarios.find(s => s.id === scenarioId);
        if (!compareToScenario) return;

        // Get the currently active working data
        const currentData = this.getCurrentPlanData();
        const currentLabel = this.currentScenarioId
            ? this.scenarios.find(s => s.id === this.currentScenarioId)?.name || "Current Plan"
            : "Base Plan";

        // Store scenario ID for potential future use
        window.currentComparisonScenarioId = scenarioId;

        let html = '';

        // Add header showing what's being compared
        html += `<div style="background: var(--primary-light); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 5px;">Comparing:</div>
            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">
                <span style="color: var(--primary-color);">${this.escapeHtml(currentLabel)}</span>
                <span style="margin: 0 10px;">vs</span>
                <span style="color: var(--secondary-color);">${this.escapeHtml(compareToScenario.name)}</span>
            </div>
        </div>`;

        // Description
        if (compareToScenario.description) {
            html += `<div class="comparison-description">
                <p><strong>${this.escapeHtml(compareToScenario.name)}:</strong> ${this.escapeHtml(compareToScenario.description)}</p>
            </div>`;
        }

        // LIQUID NET WORTH COMPARISON at 10-year intervals
        html += `<div class="comparison-section">
            <div class="comparison-section-header">
                <span class="comparison-section-icon">📊</span>
                <h3>Liquid Net Worth Differences</h3>
            </div>`;

        // Generate projections for both
        const currentEngine = new ProjectionEngine(currentData);
        const compareEngine = new ProjectionEngine(compareToScenario.data);
        const currentProj = currentEngine.projectNetWorth(40);
        const compareProj = compareEngine.projectNetWorth(40);

        html += `<div style="background: var(--primary-light); padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 13px; color: var(--text-secondary);">
            <strong>How to read:</strong> Positive values mean <span style="color: var(--secondary-color); font-weight: 600;">${this.escapeHtml(compareToScenario.name)}</span> has more liquid net worth.
            Negative values mean <span style="color: var(--primary-color); font-weight: 600;">${this.escapeHtml(currentLabel)}</span> has more.
        </div>`;

        html += `<div class="comparison-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">`;

        for (let i = 10; i <= 40; i += 10) {
            const yearIndex = Math.min(i, currentProj.length - 1);
            const currentLiquid = currentProj[yearIndex].endBalance - (currentProj[yearIndex].debtBalance || 0);
            const compareLiquid = compareProj[yearIndex].endBalance - (compareProj[yearIndex].debtBalance || 0);
            const diff = compareLiquid - currentLiquid;

            html += `<div class="comparison-summary-item">
                <div class="comparison-summary-label">Year ${i}</div>
                <div class="comparison-summary-value ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}">
                    ${diff >= 0 ? '+' : ''}$${diff.toLocaleString()}
                </div>
            </div>`;
        }

        html += `</div></div>`;

        // ACCOUNTS SECTION
        html += `<div class="comparison-section">
            <div class="comparison-section-header">
                <span class="comparison-section-icon">💰</span>
                <h3>Accounts</h3>
            </div>`;

        const currentAccounts = currentData.accounts || [];
        const scenarioAccounts = compareToScenario.data.accounts || [];
        const currentTotal = currentAccounts.reduce((sum, a) => sum + a.balance, 0);
        const scenarioTotal = scenarioAccounts.reduce((sum, a) => sum + a.balance, 0);
        const diff = scenarioTotal - currentTotal;

        html += `<div class="comparison-summary">
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">${this.escapeHtml(currentLabel)}</div>
                <div class="comparison-summary-value">$${currentTotal.toLocaleString()}</div>
            </div>
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">${this.escapeHtml(compareToScenario.name)}</div>
                <div class="comparison-summary-value">$${scenarioTotal.toLocaleString()}</div>
            </div>
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">Difference</div>
                <div class="comparison-summary-value ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}">
                    ${diff >= 0 ? '+' : ''}$${diff.toLocaleString()}
                </div>
            </div>
        </div>`;

        html += `<div class="comparison-items">`;
        scenarioAccounts.forEach(sAcc => {
            const cAcc = currentAccounts.find(a => a.id === sAcc.id || a.name === sAcc.name);
            if (!cAcc) {
                html += `<div class="comparison-item added">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">+</span>
                        <span class="comparison-item-name">${this.escapeHtml(sAcc.name)}</span>
                    </div>
                    <div class="comparison-item-details">
                        <div>Type: ${sAcc.type}</div>
                        <div>Balance: $${sAcc.balance.toLocaleString()}</div>
                    </div>
                </div>`;
            } else if (cAcc.balance !== sAcc.balance || cAcc.type !== sAcc.type) {
                html += `<div class="comparison-item changed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">≠</span>
                        <span class="comparison-item-name">${this.escapeHtml(sAcc.name)}</span>
                    </div>
                    <div class="comparison-item-details">`;
                if (cAcc.type !== sAcc.type) {
                    html += `<div>Type: ${cAcc.type} <span class="comparison-arrow">→</span> ${sAcc.type}</div>`;
                }
                if (cAcc.balance !== sAcc.balance) {
                    html += `<div>Balance: $${cAcc.balance.toLocaleString()} <span class="comparison-arrow">→</span> $${sAcc.balance.toLocaleString()}</div>`;
                }
                html += `</div></div>`;
            }
        });
        currentAccounts.forEach(cAcc => {
            if (!scenarioAccounts.find(a => a.id === cAcc.id || a.name === cAcc.name)) {
                html += `<div class="comparison-item removed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">−</span>
                        <span class="comparison-item-name">${this.escapeHtml(cAcc.name)}</span>
                    </div>
                    <div class="comparison-item-details">
                        <div>Balance: $${cAcc.balance.toLocaleString()}</div>
                    </div>
                </div>`;
            }
        });
        html += `</div></div>`;

        // INCOME SECTION
        html += `<div class="comparison-section">
            <div class="comparison-section-header">
                <span class="comparison-section-icon">💵</span>
                <h3>Income</h3>
            </div>`;

        const currentIncomes = currentData.incomes || [];
        const scenarioIncomes = compareToScenario.data.incomes || [];
        const currentIncomeTotal = currentIncomes.reduce((sum, i) => sum + i.amount * (i.frequency === 'monthly' ? 12 : 1), 0);
        const scenarioIncomeTotal = scenarioIncomes.reduce((sum, i) => sum + i.amount * (i.frequency === 'monthly' ? 12 : 1), 0);
        const incomeDiff = scenarioIncomeTotal - currentIncomeTotal;

        html += `<div class="comparison-summary">
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">${this.escapeHtml(currentLabel)}</div>
                <div class="comparison-summary-value">$${currentIncomeTotal.toLocaleString()}</div>
            </div>
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">${this.escapeHtml(compareToScenario.name)}</div>
                <div class="comparison-summary-value">$${scenarioIncomeTotal.toLocaleString()}</div>
            </div>
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">Difference</div>
                <div class="comparison-summary-value ${incomeDiff > 0 ? 'positive' : incomeDiff < 0 ? 'negative' : ''}">
                    ${incomeDiff >= 0 ? '+' : ''}$${incomeDiff.toLocaleString()}
                </div>
            </div>
        </div>`;

        html += `<div class="comparison-items">`;
        scenarioIncomes.forEach(sInc => {
            const cInc = currentIncomes.find(i => i.id === sInc.id || i.name === sInc.name);
            const sAnnual = sInc.amount * (sInc.frequency === 'monthly' ? 12 : 1);
            if (!cInc) {
                html += `<div class="comparison-item added">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">+</span>
                        <span class="comparison-item-name">${this.escapeHtml(sInc.name)}</span>
                    </div>
                    <div class="comparison-item-details">
                        <div>Amount: $${sAnnual.toLocaleString()}/year</div>
                    </div>
                </div>`;
            } else if (cInc.amount !== sInc.amount || cInc.endYear !== sInc.endYear || cInc.growth !== sInc.growth) {
                html += `<div class="comparison-item changed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">≠</span>
                        <span class="comparison-item-name">${this.escapeHtml(sInc.name)}</span>
                    </div>
                    <div class="comparison-item-details">`;
                if (cInc.amount !== sInc.amount) {
                    html += `<div>Amount: $${cInc.amount.toLocaleString()} <span class="comparison-arrow">→</span> $${sInc.amount.toLocaleString()} (${sInc.frequency})</div>`;
                }
                if (cInc.endYear !== sInc.endYear) {
                    html += `<div>End Year: ${cInc.endYear || 'none'} <span class="comparison-arrow">→</span> ${sInc.endYear || 'none'}</div>`;
                }
                if (cInc.growth !== sInc.growth) {
                    html += `<div>Growth: ${cInc.growth}% <span class="comparison-arrow">→</span> ${sInc.growth}%</div>`;
                }
                html += `</div></div>`;
            }
        });
        html += `</div></div>`;

        // EXPENSES SECTION
        html += `<div class="comparison-section">
            <div class="comparison-section-header">
                <span class="comparison-section-icon">💳</span>
                <h3>Expenses</h3>
            </div>`;

        const currentExpenses = currentData.expenses || [];
        const scenarioExpenses = compareToScenario.data.expenses || [];
        const currentExpenseTotal = currentExpenses.reduce((sum, e) => sum + e.amount * (e.frequency === 'monthly' ? 12 : 1), 0);
        const scenarioExpenseTotal = scenarioExpenses.reduce((sum, e) => sum + e.amount * (e.frequency === 'monthly' ? 12 : 1), 0);
        const expenseDiff = scenarioExpenseTotal - currentExpenseTotal;

        html += `<div class="comparison-summary">
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">${this.escapeHtml(currentLabel)}</div>
                <div class="comparison-summary-value">$${currentExpenseTotal.toLocaleString()}</div>
            </div>
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">${this.escapeHtml(compareToScenario.name)}</div>
                <div class="comparison-summary-value">$${scenarioExpenseTotal.toLocaleString()}</div>
            </div>
            <div class="comparison-summary-item">
                <div class="comparison-summary-label">Difference</div>
                <div class="comparison-summary-value ${expenseDiff > 0 ? 'negative' : expenseDiff < 0 ? 'positive' : ''}">
                    ${expenseDiff >= 0 ? '+' : ''}$${expenseDiff.toLocaleString()}
                </div>
            </div>
        </div>`;

        html += `<div class="comparison-items">`;
        scenarioExpenses.forEach(sExp => {
            const cExp = currentExpenses.find(e => e.id === sExp.id || e.name === sExp.name);
            const sAnnual = sExp.amount * (sExp.frequency === 'monthly' ? 12 : 1);
            if (!cExp) {
                html += `<div class="comparison-item added">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">+</span>
                        <span class="comparison-item-name">${this.escapeHtml(sExp.name)}</span>
                    </div>
                    <div class="comparison-item-details">
                        <div>Amount: $${sAnnual.toLocaleString()}/year</div>
                    </div>
                </div>`;
            } else if (cExp.amount !== sExp.amount || cExp.growth !== sExp.growth) {
                html += `<div class="comparison-item changed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">≠</span>
                        <span class="comparison-item-name">${this.escapeHtml(sExp.name)}</span>
                    </div>
                    <div class="comparison-item-details">`;
                if (cExp.amount !== sExp.amount) {
                    html += `<div>Amount: $${cExp.amount.toLocaleString()} <span class="comparison-arrow">→</span> $${sExp.amount.toLocaleString()} (${sExp.frequency})</div>`;
                }
                if (cExp.growth !== sExp.growth) {
                    html += `<div>Growth: ${cExp.growth}% <span class="comparison-arrow">→</span> ${sExp.growth}%</div>`;
                }
                html += `</div></div>`;
            }
        });
        html += `</div></div>`;

        // MILESTONES SECTION (THIS WAS MISSING!)
        const currentMilestones = currentData.milestones || [];
        const scenarioMilestones = compareToScenario.data.milestones || [];

        if (currentMilestones.length > 0 || scenarioMilestones.length > 0) {
            html += `<div class="comparison-section">
                <div class="comparison-section-header">
                    <span class="comparison-section-icon">🎯</span>
                    <h3>Milestones</h3>
                </div>`;

            html += `<div class="comparison-items">`;
            scenarioMilestones.forEach(sMile => {
                const cMile = currentMilestones.find(m => m.id === sMile.id || m.name === sMile.name);
                if (!cMile) {
                    html += `<div class="comparison-item added">
                        <div class="comparison-item-header">
                            <span class="comparison-item-icon">+</span>
                            <span class="comparison-item-name">${this.escapeHtml(sMile.name)}</span>
                        </div>
                        <div class="comparison-item-details">
                            <div>Year: ${sMile.year}</div>
                            <div>Amount: $${sMile.cost.toLocaleString()} ${sMile.isPositive ? '(Windfall)' : '(Cost)'}</div>
                            ${sMile.recurring ? `<div>Recurring: Every ${sMile.recurringInterval} years</div>` : ''}
                        </div>
                    </div>`;
                } else if (cMile.cost !== sMile.cost || cMile.year !== sMile.year || cMile.isPositive !== sMile.isPositive) {
                    html += `<div class="comparison-item changed">
                        <div class="comparison-item-header">
                            <span class="comparison-item-icon">≠</span>
                            <span class="comparison-item-name">${this.escapeHtml(sMile.name)}</span>
                        </div>
                        <div class="comparison-item-details">`;
                    if (cMile.year !== sMile.year) {
                        html += `<div>Year: ${cMile.year} <span class="comparison-arrow">→</span> ${sMile.year}</div>`;
                    }
                    if (cMile.cost !== sMile.cost) {
                        html += `<div>Amount: $${cMile.cost.toLocaleString()} <span class="comparison-arrow">→</span> $${sMile.cost.toLocaleString()}</div>`;
                    }
                    if (cMile.isPositive !== sMile.isPositive) {
                        html += `<div>Type: ${cMile.isPositive ? 'Windfall' : 'Cost'} <span class="comparison-arrow">→</span> ${sMile.isPositive ? 'Windfall' : 'Cost'}</div>`;
                    }
                    html += `</div></div>`;
                }
            });
            currentMilestones.forEach(cMile => {
                if (!scenarioMilestones.find(m => m.id === cMile.id || m.name === cMile.name)) {
                    html += `<div class="comparison-item removed">
                        <div class="comparison-item-header">
                            <span class="comparison-item-icon">−</span>
                            <span class="comparison-item-name">${this.escapeHtml(cMile.name)}</span>
                        </div>
                        <div class="comparison-item-details">
                            <div>Year: ${cMile.year}</div>
                            <div>Amount: $${cMile.cost.toLocaleString()}</div>
                        </div>
                    </div>`;
                }
            });
            html += `</div></div>`;
        }

        // SETTINGS SECTION
        const cSet = currentData.settings || this.model.settings;
        const sSet = compareToScenario.data.settings || {};
        let hasSettingsChanges = false;
        let settingsHtml = '';

        if (cSet.inflation !== sSet.inflation) {
            hasSettingsChanges = true;
            settingsHtml += `<div class="comparison-item changed">
                <div class="comparison-item-header">
                    <span class="comparison-item-icon">≠</span>
                    <span class="comparison-item-name">Inflation Rate</span>
                </div>
                <div class="comparison-item-details">
                    <div>${cSet.inflation}% <span class="comparison-arrow">→</span> ${sSet.inflation}%</div>
                </div>
            </div>`;
        }

        if (cSet.household?.personA?.retirementYear !== sSet.household?.personA?.retirementYear) {
            hasSettingsChanges = true;
            settingsHtml += `<div class="comparison-item changed">
                <div class="comparison-item-header">
                    <span class="comparison-item-icon">≠</span>
                    <span class="comparison-item-name">${this.escapeHtml(cSet.household.personA.name)} Retirement Year</span>
                </div>
                <div class="comparison-item-details">
                    <div>${cSet.household.personA.retirementYear} <span class="comparison-arrow">→</span> ${sSet.household.personA.retirementYear}</div>
                </div>
            </div>`;
        }

        const cSS = cSet.household?.personA?.socialSecurity || {};
        const sSS = sSet.household?.personA?.socialSecurity || {};
        if (cSS.enabled !== sSS.enabled || cSS.startAge !== sSS.startAge || cSS.annualAmount !== sSS.annualAmount) {
            hasSettingsChanges = true;
            settingsHtml += `<div class="comparison-item changed">
                <div class="comparison-item-header">
                    <span class="comparison-item-icon">≠</span>
                    <span class="comparison-item-name">${this.escapeHtml(cSet.household.personA.name)} Social Security</span>
                </div>
                <div class="comparison-item-details">`;
            if (cSS.startAge !== sSS.startAge) {
                settingsHtml += `<div>Start Age: ${cSS.startAge} <span class="comparison-arrow">→</span> ${sSS.startAge}</div>`;
            }
            if (cSS.annualAmount !== sSS.annualAmount) {
                settingsHtml += `<div>Annual Amount: $${(cSS.annualAmount || 0).toLocaleString()} <span class="comparison-arrow">→</span> $${(sSS.annualAmount || 0).toLocaleString()}</div>`;
            }
            settingsHtml += `</div></div>`;
        }

        if (cSet.household?.personB && sSet.household?.personB) {
            if (cSet.household.personB.retirementYear !== sSet.household.personB.retirementYear) {
                hasSettingsChanges = true;
                settingsHtml += `<div class="comparison-item changed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">≠</span>
                        <span class="comparison-item-name">${this.escapeHtml(cSet.household.personB.name)} Retirement Year</span>
                    </div>
                    <div class="comparison-item-details">
                        <div>${cSet.household.personB.retirementYear} <span class="comparison-arrow">→</span> ${sSet.household.personB.retirementYear}</div>
                    </div>
                </div>`;
            }

            const cSSB = cSet.household.personB.socialSecurity || {};
            const sSSB = sSet.household?.personB?.socialSecurity || {};
            if (cSSB.enabled !== sSSB.enabled || cSSB.startAge !== sSSB.startAge || cSSB.annualAmount !== sSSB.annualAmount) {
                hasSettingsChanges = true;
                settingsHtml += `<div class="comparison-item changed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">≠</span>
                        <span class="comparison-item-name">${this.escapeHtml(cSet.household.personB.name)} Social Security</span>
                    </div>
                    <div class="comparison-item-details">`;
                if (cSSB.startAge !== sSSB.startAge) {
                    settingsHtml += `<div>Start Age: ${cSSB.startAge} <span class="comparison-arrow">→</span> ${sSSB.startAge}</div>`;
                }
                if (cSSB.annualAmount !== sSSB.annualAmount) {
                    settingsHtml += `<div>Annual Amount: $${(cSSB.annualAmount || 0).toLocaleString()} <span class="comparison-arrow">→</span> $${(sSSB.annualAmount || 0).toLocaleString()}</div>`;
                }
                settingsHtml += `</div></div>`;
            }
        }

        if (hasSettingsChanges) {
            html += `<div class="comparison-section">
                <div class="comparison-section-header">
                    <span class="comparison-section-icon">⚙️</span>
                    <h3>Settings</h3>
                </div>
                <div class="comparison-items">
                    ${settingsHtml}
                </div>
            </div>`;
        }

        // WITHDRAWAL STRATEGY SECTION
        const cWithdraw = currentData.withdrawalStrategy || this.model.withdrawalStrategy;
        const sWithdraw = compareToScenario.data.withdrawalStrategy || {};
        let hasWithdrawalChanges = false;
        let withdrawalHtml = '';

        if (cWithdraw.type !== sWithdraw.type) {
            hasWithdrawalChanges = true;
            withdrawalHtml += `<div class="comparison-item changed">
                <div class="comparison-item-header">
                    <span class="comparison-item-icon">≠</span>
                    <span class="comparison-item-name">Strategy Type</span>
                </div>
                <div class="comparison-item-details">
                    <div>${cWithdraw.type} <span class="comparison-arrow">→</span> ${sWithdraw.type}</div>
                </div>
            </div>`;
        }

        if (cWithdraw.withdrawalPercentage !== sWithdraw.withdrawalPercentage) {
            hasWithdrawalChanges = true;
            withdrawalHtml += `<div class="comparison-item changed">
                <div class="comparison-item-header">
                    <span class="comparison-item-icon">≠</span>
                    <span class="comparison-item-name">Withdrawal Percentage</span>
                </div>
                <div class="comparison-item-details">
                    <div>${cWithdraw.withdrawalPercentage}% <span class="comparison-arrow">→</span> ${sWithdraw.withdrawalPercentage}%</div>
                </div>
            </div>`;
        }

        if (hasWithdrawalChanges) {
            html += `<div class="comparison-section">
                <div class="comparison-section-header">
                    <span class="comparison-section-icon">💸</span>
                    <h3>Withdrawal Strategy</h3>
                </div>
                <div class="comparison-items">
                    ${withdrawalHtml}
                </div>
            </div>`;
        }

        // INVESTMENT GLIDE PATH SECTION
        const cGlide = currentData.investmentGlidePath || this.model.investmentGlidePath || [];
        const sGlide = compareToScenario.data.investmentGlidePath || [];
        let hasGlideChanges = false;
        let glideHtml = '';

        cGlide.forEach((cPeriod, idx) => {
            const sPeriod = sGlide[idx];
            if (sPeriod && (cPeriod.expectedReturn !== sPeriod.expectedReturn || cPeriod.volatility !== sPeriod.volatility)) {
                hasGlideChanges = true;
                glideHtml += `<div class="comparison-item changed">
                    <div class="comparison-item-header">
                        <span class="comparison-item-icon">≠</span>
                        <span class="comparison-item-name">Period ${idx + 1} (${cPeriod.startYear}+)</span>
                    </div>
                    <div class="comparison-item-details">`;
                if (cPeriod.expectedReturn !== sPeriod.expectedReturn) {
                    glideHtml += `<div>Return: ${cPeriod.expectedReturn}% <span class="comparison-arrow">→</span> ${sPeriod.expectedReturn}%</div>`;
                }
                if (cPeriod.volatility !== sPeriod.volatility) {
                    glideHtml += `<div>Volatility: ${cPeriod.volatility}% <span class="comparison-arrow">→</span> ${sPeriod.volatility}%</div>`;
                }
                glideHtml += `</div></div>`;
            }
        });

        if (hasGlideChanges) {
            html += `<div class="comparison-section">
                <div class="comparison-section-header">
                    <span class="comparison-section-icon">📊</span>
                    <h3>Investment Glide Path</h3>
                </div>
                <div class="comparison-items">
                    ${glideHtml}
                </div>
            </div>`;
        }

        // Display modal
        document.getElementById('comparisonModalTitle').textContent = `Comparing: ${currentLabel} vs ${compareToScenario.name}`;
        document.getElementById('comparisonModalBody').innerHTML = html;
        document.getElementById('comparisonModal').style.display = 'flex';

        // Set up Load button handler
        document.getElementById('comparisonLoadBtn').onclick = () => {
            document.getElementById('comparisonModal').style.display = 'none';
            this.loadScenario(window.currentComparisonScenarioId);
        };
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    viewScenario(scenarioId) {
        console.log('🔄 Loading scenario:', scenarioId);

        const scenario = this.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            console.error('Scenario not found:', scenarioId);
            return;
        }

        // Migrate old housing model to new model if needed
        if (scenario.data.housing) {
            if (scenario.data.housing.status === 'rent' && scenario.data.housing.rent) {
                console.log('⚠️ Migrating scenario housing from old to new format');
                scenario.data.housing = {
                    rentalPeriods: [{
                        id: Date.now(),
                        name: 'Rental',
                        monthlyRent: scenario.data.housing.rent.monthlyRent || 0,
                        startYear: scenario.data.housing.rent.startYear || this.model.settings.planStartYear,
                        endYear: scenario.data.housing.rent.endYear || null,
                        annualIncrease: scenario.data.housing.rent.annualIncrease || 3.0,
                        securityDeposit: scenario.data.housing.rent.securityDeposit || 0
                    }],
                    ownedProperties: scenario.data.housing.ownedProperties || []
                };
            } else if (!scenario.data.housing.rentalPeriods && !scenario.data.housing.ownedProperties) {
                // Initialize empty arrays if missing
                scenario.data.housing.rentalPeriods = scenario.data.housing.rentalPeriods || [];
                scenario.data.housing.ownedProperties = scenario.data.housing.ownedProperties || [];
            }
        }

        // Save current working data as base plan if not already saved
        if (this.currentScenarioId === null && this.basePlan === null) {
            console.log('💾 Saving current state as base plan');
            this.basePlan = this.getCurrentPlanData();
        }

        // Load scenario data into working model
        console.log('📥 Loading scenario data into working model');
        this.loadPlanData(scenario.data);

        // Mark this scenario as current
        this.currentScenarioId = scenarioId;

        // Update UI
        this.updateScenarioIndicator();
        this.updateScenariosList();
        this.updateAllLists(); // Refresh all data lists
        this.updateDashboard();
        this.switchTab('dashboard');
    }

    viewBasePlan() {
        console.log('🔄 Switching back to base plan');

        // If we have a saved base plan, restore it
        if (this.basePlan !== null) {
            console.log('📥 Restoring base plan data');
            this.loadPlanData(this.basePlan);
            this.basePlan = null; // Clear the saved base plan
        }

        // Mark as viewing base plan
        this.currentScenarioId = null;

        // Update UI
        this.updateScenarioIndicator();
        this.updateScenariosList();
        this.updateAllLists(); // Refresh all data lists
        this.updateDashboard();
        this.switchTab('dashboard');
    }

    // Get current plan data (everything except scenarios)
    getCurrentPlanData() {
        return {
            accounts: JSON.parse(JSON.stringify(this.model.accounts)),
            incomes: JSON.parse(JSON.stringify(this.model.incomes)),
            expenses: JSON.parse(JSON.stringify(this.model.expenses)),
            milestones: JSON.parse(JSON.stringify(this.model.milestones)),
            settings: JSON.parse(JSON.stringify(this.model.settings)),
            investmentGlidePath: JSON.parse(JSON.stringify(this.model.investmentGlidePath)),
            withdrawalStrategy: JSON.parse(JSON.stringify(this.model.withdrawalStrategy)),
            housing: JSON.parse(JSON.stringify(this.model.housing)),
            debts: JSON.parse(JSON.stringify(this.model.debts))
        };
    }

    // Load plan data into working model
    loadPlanData(data) {
        this.model.accounts = JSON.parse(JSON.stringify(data.accounts || []));
        this.model.incomes = JSON.parse(JSON.stringify(data.incomes || []));
        this.model.expenses = JSON.parse(JSON.stringify(data.expenses || []));
        this.model.milestones = JSON.parse(JSON.stringify(data.milestones || []));
        this.model.settings = JSON.parse(JSON.stringify(data.settings || this.model.settings));
        this.model.investmentGlidePath = JSON.parse(JSON.stringify(data.investmentGlidePath || []));
        this.model.withdrawalStrategy = JSON.parse(JSON.stringify(data.withdrawalStrategy || this.model.withdrawalStrategy));
        this.model.housing = JSON.parse(JSON.stringify(data.housing || { rentalPeriods: [], ownedProperties: [] }));
        this.model.debts = JSON.parse(JSON.stringify(data.debts || { creditCards: [], loans: [] }));

        // Recreate projection engine with updated model
        this.projectionEngine = new ProjectionEngine(this.model);
        this.simulator = new MonteCarloSimulator(this.model, this.projectionEngine);
    }

    // Update all data lists in the UI
    updateAllLists() {
        this.updateAccountsList();
        this.updateIncomeList();
        this.updateExpensesList();
        this.updateMilestonesList();
        this.updateRentalPeriodsList();
        this.updatePropertiesList();
        this.updateCreditCardsList();
        this.updateLoansList();
    }

    updateScenarioIndicator() {
        const indicator = document.getElementById('currentScenarioIndicator');
        const nameElement = document.getElementById('currentScenarioName');

        if (!indicator || !nameElement) {
            console.warn('Scenario indicator elements not found in DOM');
            return;
        }

        // Always show the banner
        indicator.style.display = 'flex';

        if (this.currentScenarioId) {
            const scenario = this.scenarios.find(s => s.id === this.currentScenarioId);
            if (scenario) {
                // Viewing a saved scenario
                nameElement.innerHTML = `<strong>${this.escapeHtml(scenario.name)}</strong>`;
                indicator.style.background = 'var(--primary-light)';
                indicator.style.borderColor = 'var(--primary-color)';
            } else {
                // Scenario was deleted, clear the ID
                this.currentScenarioId = null;
                this.showBasePlanIndicator(indicator, nameElement);
            }
        } else {
            // Viewing base plan
            this.showBasePlanIndicator(indicator, nameElement);
        }
    }

    showBasePlanIndicator(indicator, nameElement) {
        // Show base plan message
        if (this.scenarios.length === 0) {
            nameElement.innerHTML = '<strong>Base Plan</strong> <span style="color: var(--text-secondary); font-weight: 400; font-size: 14px;">(Create scenarios on the Scenarios tab to compare alternatives)</span>';
        } else {
            nameElement.innerHTML = '<strong>Base Plan</strong> <span style="color: var(--text-secondary); font-weight: 400; font-size: 14px;">(Switch to a saved scenario on the Scenarios tab)</span>';
        }
        indicator.style.background = '#f3f4f6';
        indicator.style.borderColor = '#9ca3af';
    }

    deleteScenario(scenarioId) {
        const scenario = this.scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        const confirmed = confirm(`Delete scenario "${scenario.name}"?`);
        if (!confirmed) return;

        this.scenarios = this.scenarios.filter(s => s.id !== scenarioId);
        this.saveData();
        this.updateScenariosList();
    }

    clearScenarios() {
        if (this.scenarios.length === 0) {
            alert('No scenarios to clear.');
            return;
        }

        const confirmed = confirm(`Delete all ${this.scenarios.length} saved scenarios?\n\nThis cannot be undone.`);
        if (!confirmed) return;

        this.scenarios = [];
        this.saveData();
        this.updateScenariosList();
        alert('✓ All scenarios cleared.');
    }

    updateScenariosList() {
        const container = document.getElementById('scenariosList');
        const comparisonCard = document.getElementById('scenarioComparisonCard');

        if (this.scenarios.length === 0) {
            container.innerHTML = '<p style="color: #64748b; padding: 20px; text-align: center;">No saved scenarios yet. Save your current plan as a scenario to get started!</p>';
            comparisonCard.style.display = 'none';
            return;
        }

        container.innerHTML = '<div class="item-list">' +
            this.scenarios.map(scenario => {
                const date = new Date(scenario.date).toLocaleDateString();
                const isCurrent = this.currentScenarioId === scenario.id;
                const currentBadge = isCurrent ? '<span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; font-weight: 600;">CURRENT</span>' : '';
                const highlightStyle = isCurrent ? 'border: 2px solid var(--success); background: rgba(16, 185, 129, 0.05);' : '';

                const descriptionHtml = scenario.description
                    ? `<p style="color: #64748b; font-size: 14px; margin-top: 8px; font-style: italic;">${this.escapeHtml(scenario.description)}</p>`
                    : '';

                return `
                    <div class="list-item" style="${highlightStyle}">
                        <div class="list-item-info">
                            <h3>${scenario.name}${currentBadge}</h3>
                            <p>Saved on ${date}</p>
                            ${descriptionHtml}
                        </div>
                        <div class="list-item-actions">
                            <button class="btn btn-primary" onclick="ui.viewScenario(${scenario.id})" ${isCurrent ? 'disabled' : ''}>Load</button>
                            ${isCurrent ? `<button class="btn btn-success" onclick="ui.updateCurrentScenario()">Update</button>` : ''}
                            <button class="btn btn-secondary" onclick="ui.compareScenario(${scenario.id})">Compare</button>
                            <button class="btn btn-danger" onclick="ui.deleteScenario(${scenario.id})">Delete</button>
                        </div>
                    </div>
                `;
            }).join('') +
            '</div>';

        // Show comparison chart if we have multiple scenarios
        if (this.scenarios.length >= 2) {
            comparisonCard.style.display = 'block';
            this.updateScenarioComparisonChart();
        } else {
            comparisonCard.style.display = 'none';
        }
    }

    updateScenarioComparisonChart() {
        const ctx = document.getElementById('scenarioComparisonChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.scenarioComparison) {
            this.charts.scenarioComparison.destroy();
        }

        const colors = [
            '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
        ];

        const datasets = [];

        this.scenarios.forEach((scenario, index) => {
            // Create a temporary model with this scenario's data
            const tempModel = new FinancialModel();
            tempModel.accounts = scenario.data.accounts;
            tempModel.incomes = scenario.data.incomes;
            tempModel.expenses = scenario.data.expenses;
            tempModel.milestones = scenario.data.milestones;
            tempModel.settings = scenario.data.settings;
            tempModel.investmentGlidePath = scenario.data.investmentGlidePath;
            tempModel.withdrawalStrategy = scenario.data.withdrawalStrategy;
            tempModel.housing = scenario.data.housing || tempModel.housing;
            tempModel.debts = scenario.data.debts || tempModel.debts;

            const tempEngine = new ProjectionEngine(tempModel);
            const projections = tempEngine.projectNetWorth(40);

            const color = colors[index % colors.length];

            // Total net worth (solid line)
            datasets.push({
                label: `${scenario.name} (Total)`,
                data: projections.map(p => p.netWorth),
                borderColor: color,
                backgroundColor: 'transparent',
                fill: false,
                borderWidth: 3,
                tension: 0.4
            });

            // Liquid net worth (dotted line, same color)
            datasets.push({
                label: `${scenario.name} (Liquid)`,
                data: projections.map(p => p.netWorth - (p.homeEquity || 0)),
                borderColor: color,
                backgroundColor: 'transparent',
                fill: false,
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4
            });
        });

        const years = [];
        const currentYear = new Date().getFullYear();
        for (let i = 0; i <= 40; i++) {
            years.push(currentYear + i);
        }

        this.charts.scenarioComparison = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Scenario Comparison: Solid = Total Net Worth, Dotted = Liquid (Excluding Home)',
                        font: { size: 13, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                }
            }
        });
    }

    deleteAllData() {
        const confirmed = confirm('⚠️ WARNING: This will permanently delete ALL your data including accounts, income, expenses, milestones, and investment glide path.\n\nThis action cannot be undone.\n\nAre you absolutely sure you want to delete everything?');

        if (confirmed) {
            const doubleCheck = confirm('Last chance! Click OK to permanently delete all your financial data, or Cancel to keep it.');

            if (doubleCheck) {
                // Clear the model
                this.model.accounts = [];
                this.model.incomes = [];
                this.model.expenses = [];
                this.model.milestones = [];
                this.model.investmentGlidePath = [
                    { startYear: new Date().getFullYear(), expectedReturn: 7, volatility: 15 }
                ];
                this.scenarios = [];
                this.model.withdrawalStrategy = {
                    type: 'fixed_percentage',
                    withdrawalPercentage: 4,
                    fixedAmount: 40000,
                    inflationAdjusted: true,
                    dynamicInitialRate: 5,
                    dynamicUpperGuardrail: 20,
                    dynamicLowerGuardrail: 20,
                    rmdStartAge: 73,
                    withdrawalStartYear: 2050,
                    autoWithdrawalStart: true,
                    withdrawalMode: 'always'
                };

                // Reset settings to defaults (including Social Security and Pension)
                const currentYear = new Date().getFullYear();
                this.model.settings = {
                    planStartYear: currentYear,
                    projectionHorizon: 40,
                    inflation: 3.0,
                    filingStatus: 'single',
                    household: {
                        personA: {
                            name: 'Person A',
                            birthYear: currentYear - 30,
                            retirementYear: currentYear + 35,
                            lifeExpectancy: 90,
                            socialSecurity: {
                                enabled: false,
                                annualAmount: 0,
                                startAge: 67
                            }
                        },
                        personB: null
                    },
                    pension: {
                        enabled: false,
                        owner: 'personA',
                        name: '',
                        annualAmount: 0,
                        startYear: currentYear,
                        growth: 0
                    }
                };

                // Clear localStorage
                localStorage.removeItem('financialModel');

                // Update UI
                this.updateDashboard();
                this.updateGlidePathList();
                this.updateSettingsForm();

                alert('✓ All data has been deleted, including Social Security and pension settings.');
            }
        }
    }
}

// Initialize the application
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new UIController();
});
