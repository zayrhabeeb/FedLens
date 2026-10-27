/**
 * Rule-based implication mapping (PRD §5.2). A fixed scenario tree keyed by
 * event type and direction. Outputs are framed as conditional implications
 * ("if accurate, likely…"), never as predictions.
 */
import { getCountry } from '../shared/countries';
import type { CountryCode, EventType, RateDirection, Stance } from '../shared/types';

export interface ImplicationSet {
  macroImpact: string;
  policyImplication: string;
  marketSignals: string;
  risks: string;
  whatToWatch: string;
}

interface Context {
  country: CountryCode;
  type: EventType;
  direction?: RateDirection;
  stance: Stance;
}

type Rule = (c: { name: string; bank: string; ccy: string }, ctx: Context) => ImplicationSet;

const RULES: Record<EventType, Rule> = {
  RATE_DECISION: ({ name, bank, ccy }, { direction }) =>
    direction === 'hike'
      ? {
          macroImpact: `Tighter financial conditions in ${name}; credit growth and interest-sensitive spending (housing, durables) likely slow over 2–4 quarters.`,
          policyImplication: `${bank} is prioritising inflation; further hikes depend on incoming CPI and wage data.`,
          marketSignals: `Typically supportive for ${ccy}; front-end yields rise; equity valuations face pressure.`,
          risks: 'Over-tightening into a slowdown; stress in leveraged sectors.',
          whatToWatch: `Next CPI print, ${bank} forward guidance, credit spreads.`,
        }
      : direction === 'cut'
        ? {
            macroImpact: `Easier financial conditions in ${name}; borrowing costs fall with a typical lag of 6–12 months.`,
            policyImplication: `${bank} sees inflation risks as contained or growth risks as rising.`,
            marketSignals: `Typically weighs on ${ccy}; front-end yields fall; curve may steepen.`,
            risks: 'Inflation re-accelerating; currency depreciation feeding import prices.',
            whatToWatch: `Guidance on the pace of further cuts, inflation expectations, ${ccy} moves.`,
          }
        : {
            macroImpact: `Policy settings in ${name} unchanged; current financial conditions persist.`,
            policyImplication: `${bank} is waiting for more data; the bias in the statement matters more than the decision.`,
            marketSignals: `Limited direct effect; ${ccy} and yields react to the guidance tone.`,
            risks: 'Falling behind the curve if inflation or growth surprise.',
            whatToWatch: `Changes in statement language, dissenting votes, next ${bank} meeting date.`,
          },
  INFLATION_PRINT: ({ name, bank }, { stance }) => ({
    macroImpact: `Shapes real incomes and consumption in ${name}.`,
    policyImplication:
      stance === 'hawkish'
        ? `Firm inflation keeps pressure on ${bank} to stay restrictive or tighten.`
        : stance === 'dovish'
          ? `Cooling inflation gives ${bank} room to ease.`
          : `Mixed signal for ${bank}; core measures and services inflation are decisive.`,
    marketSignals: 'Rate expectations reprice; short-dated yields most sensitive.',
    risks: 'One-off base effects or energy prices distorting the headline.',
    whatToWatch: 'Core vs headline gap, services inflation, wage growth.',
  }),
  GDP_RELEASE: ({ name, bank }) => ({
    macroImpact: `Updates the growth picture for ${name}; revisions are common.`,
    policyImplication: `Weak growth raises the bar for ${bank} tightening; strong growth lowers the bar.`,
    marketSignals:
      'Equities and cyclical sectors most sensitive; currency reacts to policy repricing.',
    risks: 'Advance estimates are revised; composition (inventories, net exports) can mislead.',
    whatToWatch: 'Private demand components, revisions, PMI surveys.',
  }),
  FISCAL_ACTION: ({ name, bank }) => ({
    macroImpact: `Changes the fiscal impulse in ${name}; size and timing determine the growth effect.`,
    policyImplication: `Expansionary fiscal policy can complicate ${bank}'s inflation fight.`,
    marketSignals: 'Long-end yields sensitive to issuance; term premium may rise.',
    risks: 'Debt sustainability concerns; implementation delays.',
    whatToWatch: 'Bond auction demand, rating agency commentary, legislative timeline.',
  }),
  TRADE_EVENT: ({ name, ccy }) => ({
    macroImpact: `Affects export volumes and import prices in ${name}; supply chains adjust over quarters.`,
    policyImplication:
      'Tariffs are a supply shock: higher prices and weaker growth at the same time.',
    marketSignals: `${ccy} and trade-exposed sectors react first.`,
    risks: 'Retaliation and escalation; uncertainty delaying investment.',
    whatToWatch: 'Retaliatory measures, trade data, corporate guidance.',
  }),
  CURRENCY_SHOCK: ({ name, bank, ccy }) => ({
    macroImpact: `A sharp ${ccy} move changes import prices and competitiveness for ${name}.`,
    policyImplication: `${bank} may intervene or adjust rates to stabilise the currency.`,
    marketSignals: 'FX volatility rises; foreign-currency debt burdens shift.',
    risks: 'Capital outflows, imported inflation, reserve depletion.',
    whatToWatch: 'FX reserves, intervention statements, capital-flow data.',
  }),
  ELECTION_RESULT: ({ name }) => ({
    macroImpact: `Policy direction in ${name} may change; effects depend on the platform and majority.`,
    policyImplication: 'Watch fiscal plans and any stated views on central-bank independence.',
    marketSignals: 'Risk premia adjust quickly to perceived policy credibility.',
    risks: 'Gridlock, contested results, abrupt fiscal shifts.',
    whatToWatch: 'Cabinet appointments, first budget, coalition agreements.',
  }),
  CENTRAL_BANK_SPEECH: ({ bank }, { stance }) => ({
    macroImpact: 'Speeches shape expectations rather than conditions directly.',
    policyImplication:
      stance === 'neutral'
        ? `No clear shift in ${bank}'s bias detected from the language.`
        : `Language leans ${stance}; markets may price a ${stance === 'hawkish' ? 'tighter' : 'looser'} path.`,
    marketSignals: 'Front-end rates and the currency react to perceived bias.',
    risks: 'Individual speakers may not represent the committee consensus.',
    whatToWatch: 'Whether other officials echo the message; next meeting minutes.',
  }),
  EXTERNAL_SHOCK: ({ name }) => ({
    macroImpact: `Supply-side shock for ${name}: pressure on prices and on output simultaneously.`,
    policyImplication:
      'Central banks usually look through first-round effects but react to second-round effects.',
    marketSignals: 'Commodity-linked currencies and sectors move most.',
    risks: 'Persistence of the shock; inflation expectations de-anchoring.',
    whatToWatch: 'Commodity futures curves, inflation expectations surveys.',
  }),
};

export function mapImplications(ctx: Context): ImplicationSet {
  const c = getCountry(ctx.country);
  return RULES[ctx.type]({ name: c.name, bank: c.centralBank, ccy: c.currency }, ctx);
}
