/**
 * Reliability + speed + batch model
 *
 * Core variables:
 *   p       : probability a worker/tool does a job correctly on first try
 *   B, L    : benefit / loss (not used in batch demo, but kept for completeness)
 *   C       : verification cost per attempt
 *   F       : fix/rework cost per bad attempt
 *   w       : wage / cost per attempt
 *
 * Time variables (hours):
 *   tWork   : worker time per attempt
 *   tVerify : verification time per attempt
 *   tFix    : extra time to fix/rework when wrong
 *
 * We assume mandatory verification: every job is checked, bad ones are reworked.
 */

// ---------------------------------------------------------------------------
// 1. Expected value (trust vs verify)
// ---------------------------------------------------------------------------

function expectedValueTrust({ p, B, L }) {
	// EV_trust = p * B - (1 - p) * L
	return p * B - (1 - p) * L;
}

function expectedValueVerify({ p, B, C, F }) {
	// EV_verify = B - C - (1 - p) * F
	return B - C - (1 - p) * F;
}

// ---------------------------------------------------------------------------
// 2. Expected COST per finished job under mandatory verification
// ---------------------------------------------------------------------------

function expectedCostWithVerification({ p, w, C, F }) {
	// Cost_per_finished_job = w + C + (1 - p) * F
	return w + C + (1 - p) * F;
}

// ---------------------------------------------------------------------------
// 3. Expected TIME and throughput under mandatory verification
// ---------------------------------------------------------------------------

function expectedTimeWithVerification({ p, tWork, tVerify, tFix }) {
	// Time_per_finished_job = tWork + tVerify + (1 - p) * tFix
	return tWork + tVerify + (1 - p) * tFix;
}

function jobsPerHour(expectedTimePerJobHours) {
	return 1 / expectedTimePerJobHours;
}

// ---------------------------------------------------------------------------
// 4. Compare two workers on COST and SPEED (per-job view)
// ---------------------------------------------------------------------------

function compareWorkersCostAndSpeed(workerA, workerB, sharedCost, sharedTime) {
	const eps = 1e-9;

	const costA = expectedCostWithVerification({
		p: workerA.p,
		w: workerA.w,
		C: sharedCost.C,
		F: sharedCost.F,
	});
	const costB = expectedCostWithVerification({
		p: workerB.p,
		w: workerB.w,
		C: sharedCost.C,
		F: sharedCost.F,
	});

	const timeA = expectedTimeWithVerification({
		p: workerA.p,
		tWork: workerA.tWork,
		tVerify: sharedTime.tVerify,
		tFix: sharedTime.tFix,
	});
	const timeB = expectedTimeWithVerification({
		p: workerB.p,
		tWork: workerB.tWork,
		tVerify: sharedTime.tVerify,
		tFix: sharedTime.tFix,
	});

	const throughputA = jobsPerHour(timeA);
	const throughputB = jobsPerHour(timeB);

	let cheaper = null;
	if (Math.abs(costA - costB) > eps) cheaper = costA < costB ? "A" : "B";

	let faster = null;
	if (Math.abs(timeA - timeB) > eps) faster = timeA < timeB ? "A" : "B";

	return {
		cost: { costA, costB, cheaper, diff: Math.abs(costA - costB) },
		time: {
			timeA,
			timeB,
			throughputA,
			throughputB,
			faster,
			diff: Math.abs(timeA - timeB),
		},
	};
}

// ---------------------------------------------------------------------------
// 5. Reliability premium (how much more wage can you justify)
// ---------------------------------------------------------------------------

function maxWagePremiumForHigherReliability({ pLow, pHigh, F }) {
	// maxPremium = (pHigh - pLow) * F
	return (pHigh - pLow) * F;
}

// ---------------------------------------------------------------------------
// 6. Batch layer: reuse per-job math over N attempts
// ---------------------------------------------------------------------------

/**
 * Summarize a batch for a worker over a fixed number of attempts.
 *
 * We do NOT introduce new math; we just multiply the per-job expectations:
 *  - cost_per_job  = expectedCostWithVerification(...)
 *  - time_per_job  = expectedTimeWithVerification(...)
 *  - cost_batch    = attempts * cost_per_job
 *  - time_batch    = attempts * time_per_job
 */
function summarizeBatchByAttempts({ label, attempts, worker, sharedCost, sharedTime }) {
	const costPerJob = expectedCostWithVerification({
		p: worker.p,
		w: worker.w,
		C: sharedCost.C,
		F: sharedCost.F,
	});

	const timePerJob = expectedTimeWithVerification({
		p: worker.p,
		tWork: worker.tWork,
		tVerify: sharedTime.tVerify,
		tFix: sharedTime.tFix,
	});

	const totalCost = attempts * costPerJob;
	const totalTime = attempts * timePerJob;

	const expectedCorrectFirstPass = worker.p * attempts;
	const expectedWrongFirstPass = (1 - worker.p) * attempts;

	// Because we always verify+fix, finished correct units ~= attempts (in expectation)
	const finishedCorrectUnits = attempts;

	return {
		label,
		attempts,
		p: worker.p,
		w: worker.w,
		costPerJob,
		timePerJob,
		totalCost,
		totalTime,
		expectedCorrectFirstPass,
		expectedWrongFirstPass,
		finishedCorrectUnits,
	};
}

function printBatchSummary(summary) {
	console.log(`=== ${summary.label} ===`);
	console.log(`Attempts (units produced): ${summary.attempts}`);
	console.log(
		`Expected correct on first pass : ${summary.expectedCorrectFirstPass.toFixed(2)}`
	);
	console.log(
		`Expected wrong on first pass   : ${summary.expectedWrongFirstPass.toFixed(2)}`
	);
	console.log();
	console.log(`Cost per finished job         : ${summary.costPerJob.toFixed(2)}`);
	console.log(`Time per finished job (hours) : ${summary.timePerJob.toFixed(3)}`);
	console.log();
	console.log(`TOTAL cost for batch          : ${summary.totalCost.toFixed(2)}`);
	console.log(`TOTAL time for batch (hours)  : ${summary.totalTime.toFixed(2)}`);
	console.log(
		`Finished correct units (after rework): ${summary.finishedCorrectUnits}`
	);
	console.log();
}

function compareBatches(fastSummary, slowSummary) {
	console.log("=== BATCH COMPARISON: Fast but sloppy vs Slow but careful ===\n");

	printBatchSummary(fastSummary);
	printBatchSummary(slowSummary);

	const extraUnits =
		fastSummary.finishedCorrectUnits - slowSummary.finishedCorrectUnits;
	const extraCost = fastSummary.totalCost - slowSummary.totalCost;
	const extraTime = fastSummary.totalTime - slowSummary.totalTime;

	console.log("=== DELTAS (Fast minus Slow) ===");
	console.log(`Extra finished correct units : ${extraUnits}`);
	console.log(`Extra total cost             : ${extraCost.toFixed(2)}`);
	console.log(`Extra total time (hours)     : ${extraTime.toFixed(2)}`);
	if (extraUnits !== 0) {
		console.log(
			`Extra cost per extra finished unit : ${(extraCost / extraUnits).toFixed(2)}`
		);
		console.log(
			`Extra time per extra finished unit : ${(extraTime / extraUnits).toFixed(3)} h`
		);
	}
	console.log();
}

// ---------------------------------------------------------------------------
// 7. Scenario wiring: web development-style numbers
// ---------------------------------------------------------------------------

const fastWorker = {
	label: "Fast but sloppy dev",
	p: 0.7,         // 70% of tickets pass review/tests first time
	w: 120 * 3.0,   // 3 hours per ticket at $120/h = $360 per attempt
	tWork: 3.0      // 3 hours of dev work per ticket
};

const slowWorker = {
	label: "Slow but careful dev",
	p: 0.95,        // 95% pass on first try
	w: 120 * 4.0,   // 4 hours per ticket at $120/h = $480 per attempt
	tWork: 4.0      // 4 hours of dev work per ticket
};

// Shared verification and rework behaviour
const sharedCost = {
	C: 160 * 0.75,  // reviewer at $160/h for 0.75h per ticket ⇒ $120
	F: 140 * 2.25,  // rework: 2.25h at blended $140/h ⇒ $315 per bad ticket
};

const sharedTime = {
	tVerify: 0.75,  // 45 minutes review time per ticket
	tFix: 2.25,     // 2.25 hours extra dev+review when ticket is wrong
};

// ---------------------------------------------------------------------------
// 7a. PER-JOB VIEW
// ---------------------------------------------------------------------------

console.log("=== PER-JOB VIEW ===\n");

const perJob = compareWorkersCostAndSpeed(
	fastWorker,
	slowWorker,
	sharedCost,
	sharedTime
);

console.log("Cost per finished job (ticket):");
console.log(
	`  Fast: ${perJob.cost.costA.toFixed(2)} USD | Slow: ${perJob.cost.costB.toFixed(
		2
	)} USD`
);
console.log();

console.log("Time per finished job (hours) and tickets/hour:");
console.log(
	`  Fast: ${perJob.time.timeA.toFixed(2)} h (${perJob.time.throughputA.toFixed(
		2
	)} tickets/h)`
);
console.log(
	`  Slow: ${perJob.time.timeB.toFixed(2)} h (${perJob.time.throughputB.toFixed(
		2
	)} tickets/h)\n`
);

// ---------------------------------------------------------------------------
// 7b. BATCH VIEW: 80-hour sprint
// ---------------------------------------------------------------------------

console.log("=== BATCH VIEW: 80-hour sprint ===\n");

// how many finished tickets each can do in ~80 hours, given expected time/job
const sprintHours = 80;

const fastAttempts = Math.floor(sprintHours / perJob.time.timeA);
const slowAttempts = Math.floor(sprintHours / perJob.time.timeB);

const slowBatch = summarizeBatchByAttempts({
	label: slowWorker.label,
	attempts: slowAttempts,
	worker: slowWorker,
	sharedCost,
	sharedTime,
});

const fastBatch = summarizeBatchByAttempts({
	label: fastWorker.label,
	attempts: fastAttempts,
	worker: fastWorker,
	sharedCost,
	sharedTime,
});

compareBatches(fastBatch, slowBatch);

// ---------------------------------------------------------------------------
// 7c. RELIABILITY PREMIUM (per ticket attempt)
// ---------------------------------------------------------------------------

const premium = maxWagePremiumForHigherReliability({
	pLow: fastWorker.p,
	pHigh: slowWorker.p,
	F: sharedCost.F,
});
console.log("Reliability premium (per ticket attempt):");
console.log(
	`  Max extra wage you can justify for slow over fast: ${premium.toFixed(
		2
	)} USD`
);
console.log(
	`  Actual wage gap (slow - fast): ${(slowWorker.w - fastWorker.w).toFixed(
		2
	)} USD`
);
console.log();

// ---------------------------------------------------------------------------
// 7d. FINANCIAL COMPARISON: both companies sell units at the same price
// ---------------------------------------------------------------------------

console.log("=== FINANCIAL COMPARISON GIVEN UNIT PRICE ===\n");

const costPerUnitFast = perJob.cost.costA;
const costPerUnitSlow = perJob.cost.costB;

console.log("Implied cost per finished unit (from per-job view):");
console.log(`  Fast company: ${costPerUnitFast.toFixed(2)} USD`);
console.log(`  Slow company: ${costPerUnitSlow.toFixed(2)} USD\n`);

// incremental break-even unit price of the EXTRA units Fast produces
const extraUnits =
	fastBatch.finishedCorrectUnits - slowBatch.finishedCorrectUnits;
const extraCost = fastBatch.totalCost - slowBatch.totalCost;
const breakEvenPrice = extraCost / extraUnits;

console.log("Incremental break-even price of Fast's extra units:");
console.log(
	`  Extra units produced by Fast vs Slow : ${extraUnits}`
);
console.log(
	`  Extra total cost of Fast vs Slow     : ${extraCost.toFixed(2)} USD`
);
console.log(
	`  Break-even price per unit (extraCost / extraUnits): ${breakEvenPrice.toFixed(
		2
	)} USD\n`
);

// choose some realistic selling prices to compare profitability
const unitPrices = [600, 1000, 2000];

console.log("Profits per 80-hour sprint at different unit prices:");
console.log(
	"  (Fast company = employs fast dev; Slow company = employs slow dev)\n"
);

for (const P of unitPrices) {
	const revenueFast = fastBatch.finishedCorrectUnits * P;
	const revenueSlow = slowBatch.finishedCorrectUnits * P;

	const profitFast = revenueFast - fastBatch.totalCost;
	const profitSlow = revenueSlow - slowBatch.totalCost;

	const diff = profitFast - profitSlow;
	const winner =
		Math.abs(diff) < 1e-9
			? "Tie"
			: diff > 0
			? "Fast company ahead"
			: "Slow company ahead";

	console.log(`Unit price P = ${P} USD`);
	console.log(
		`  Fast company: revenue = ${revenueFast.toFixed(
			2
		)}, profit = ${profitFast.toFixed(2)}`
	);
	console.log(
		`  Slow company: revenue = ${revenueSlow.toFixed(
			2
		)}, profit = ${profitSlow.toFixed(2)}`
	);
	console.log(`  Difference (Fast - Slow): ${diff.toFixed(2)}  → ${winner}`);
	console.log();
}

// One-line summary about the break-even price
console.log(
	`Summary: if the market price per finished unit P is greater than about ${breakEvenPrice.toFixed(
		2
	)} USD (and clearly it must exceed ~${costPerUnitFast.toFixed(
		0
	)}–${costPerUnitSlow.toFixed(
		0
	)} to be viable at all), the fast-but-sloppy shop is more profitable in this parameter setup; below that, the slow-but-careful shop is better.`
);

// ---------------------------------------------------------------------------
// 7e. PARAM SWEEP: trade-off between fast/sloppy and slow/careful
// ---------------------------------------------------------------------------

console.log(
	"\n=== PARAM SWEEP: trade-off between fast/sloppy and slow/careful ===\n"
);

/**
 * Idea:
 * - Slow worker is fixed.
 * - Fast worker trades reliability for speed.
 * - BUT speedup is capped: being wildly sloppy doesn't make you infinitely fast.
 *
 * Model:
 *   tWorkFast_linear = slow.tWork * (pFast / slow.p)
 *   tWorkFast = max(tWorkFast_linear, speedFloor * slow.tWork)
 *
 * With speedFloor = 0.5:
 *   - At pFast = slow.p  → tWorkFast ≈ slow.tWork (same speed as slow).
 *   - At pFast → 0       → tWorkFast floors at 0.5 * slow.tWork (max 2× faster).
 *
 * Rework (F, tFix) and verification (C, tVerify) stay the same.
 * As pFast drops, rework load grows, but speed benefit eventually saturates.
 */

const sweepUnitPrice = 1000; // selling price per finished ticket
const sweepSprintHours = 80; // sprint length (hours)
const devHourlyRate = slowWorker.w / slowWorker.tWork; // should be 120 USD/h

function tWorkFastCapped(pFast) {
	const speedFloor = 0.5; // cannot be more than 2x faster than slow
	const linear = slowWorker.tWork * (pFast / slowWorker.p);
	const minWork = slowWorker.tWork * speedFloor;
	return Math.max(linear, minWork);
}

// Precompute slow's batch once for this sweep
const slowTimePerJobSweep = expectedTimeWithVerification({
	p: slowWorker.p,
	tWork: slowWorker.tWork,
	tVerify: sharedTime.tVerify,
	tFix: sharedTime.tFix,
});
const slowCostPerJobSweep = expectedCostWithVerification({
	p: slowWorker.p,
	w: slowWorker.w,
	C: sharedCost.C,
	F: sharedCost.F,
});

const slowAttemptsSweep = Math.floor(
	sweepSprintHours / slowTimePerJobSweep
);

const slowBatchSweep = summarizeBatchByAttempts({
	label: slowWorker.label,
	attempts: slowAttemptsSweep,
	worker: slowWorker,
	sharedCost,
	sharedTime,
});

const slowRevenueSweep = slowBatchSweep.finishedCorrectUnits * sweepUnitPrice;
const slowProfitSweep = slowRevenueSweep - slowBatchSweep.totalCost;

console.log(
	`Sweep settings: unit price P = ${sweepUnitPrice} USD, sprint = ${sweepSprintHours} hours`
);
console.log(
	`Slow dev fixed at p = ${slowWorker.p}, tWork = ${slowWorker.tWork} h, attempts ≈ ${slowAttemptsSweep}`
);
console.log(
	`Slow profit per sprint at this price: ${slowProfitSweep.toFixed(2)} USD\n`
);

// Table header
const headerCols = [
	"pFast",
	"tWorkFast(h)",
	"attempts",
	"profitFast",
	"Δprofit",
	"winner",
];
const header = headerCols.map((h) => h.padStart(13)).join(" | ");
const separator = "-".repeat(header.length);

console.log(header);
console.log(separator);

// Sweep pFast from near-slow down to very sloppy
const sweepPoints = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.18, 0.16, 0.14, 0.12, 0.10, 0.0];

for (const pFast of sweepPoints) {
	const tWorkFast = tWorkFastCapped(pFast);
	const fastTimePerJobSweep = expectedTimeWithVerification({
		p: pFast,
		tWork: tWorkFast,
		tVerify: sharedTime.tVerify,
		tFix: sharedTime.tFix,
	});
	const fastCostPerJobSweep = expectedCostWithVerification({
		p: pFast,
		w: devHourlyRate * tWorkFast,
		C: sharedCost.C,
		F: sharedCost.F,
	});

	const fastAttemptsSweep = Math.floor(
		sweepSprintHours / fastTimePerJobSweep
	);

	const fastBatchSweep = summarizeBatchByAttempts({
		label: `Fast p=${pFast.toFixed(2)}`,
		attempts: fastAttemptsSweep,
		worker: { p: pFast, w: devHourlyRate * tWorkFast, tWork: tWorkFast },
		sharedCost,
		sharedTime,
	});

	const fastRevenueSweep =
		fastBatchSweep.finishedCorrectUnits * sweepUnitPrice;
	const fastProfitSweep = fastRevenueSweep - fastBatchSweep.totalCost;

	const profitDiff = fastProfitSweep - slowProfitSweep;
	const winner =
		Math.abs(profitDiff) < 1e-6
			? "Tie"
			: profitDiff > 0
			? "Fast"
			: "Slow";

	const row = [
		pFast.toFixed(2).padStart(13),
		tWorkFast.toFixed(2).padStart(13),
		String(fastAttemptsSweep).padStart(13),
		fastProfitSweep.toFixed(2).padStart(13),
		profitDiff.toFixed(2).padStart(13),
		winner.padStart(13),
	].join(" | ");

	console.log(row);
}

console.log(`
Interpretation:
- For pFast around 0.9–0.5, Fast is both faster and more profitable: some sloppiness is worth it.
- Below a certain reliability (around pFast ≈ 0.13 in this setup), extra speed doesn't improve
  much (tWorkFast is floored), but rework keeps rising, so Δprofit turns negative and "Slow"
  becomes the winner.
- As pFast → 0, Fast is effectively "do minimal dev work and let verification/rework do everything",
  which is strictly worse than just letting the careful dev own the work.`);


  // ---------------------------------------------------------------------------
// 7f. PARAM SWEEP: cheap fast dev + expensive slow verifier
// ---------------------------------------------------------------------------

console.log(
	"\n=== PARAM SWEEP 2: cheap fast dev + expensive slow verifier ===\n"
);

/**
 * Assumptions for this sweep:
 *
 * - Slow dev (baseline) is your existing slowWorker:
 *     pSlow  = 0.95
 *     tWork  = 4 h
 *     rate   = 120 USD/h  (derived from slowWorker)
 *
 * - Fast dev:
 *     cheaper per hour (e.g. 80 USD/h)
 *     tWorkFast shrinks linearly with reliability:
 *       tWorkFast(pFast) = tWorkSlow * (pFast / pSlow)
 *     so lower pFast => less dev time, but more rework.
 *
 * - Verifier / rework dev:
 *     verifies *and* does rework when tickets fail
 *     rateVerifier = 180 USD/h (more expensive)
 *     tVerify      = 0.75 h per ticket (review/tests)
 *     tFix         = 4 h per bad ticket (redo/cleanup)
 *
 *   Rework cost/time (for both fast and slow) comes entirely from this
 *   verifier: you are effectively asking "what happens when we lean on
 *   a very expensive fixer to compensate for fast sloppiness?"
 *
 * We compare profits over an 80-hour sprint for different pFast values
 * at a fixed unit price P.
 */

const sweep2UnitPrice = 1000;      // price per finished ticket
const sweep2SprintHours = 80;      // sprint length
const slowDevRate = slowWorker.w / slowWorker.tWork; // 120 USD/h
const fastDevRate = 80;           // cheap fast dev
const verifierRate = 180;         // expensive verifier

// Verification + rework parameters for this sweep
const tVerify2 = sharedTime.tVerify; // 0.75 h
const tFix2 = 4.0;                   // 4 h rework by verifier
const C2 = sharedCost.C;             // verification cost per ticket = 160 * 0.75
const F2 = verifierRate * tFix2;     // rework cost per bad ticket

// Helper: time & cost per job given (p, tWork, hourlyRate)
function timeCostPerJobSweep2(p, tWork, hourlyRate) {
	const timePerJob = expectedTimeWithVerification({
		p,
		tWork,
		tVerify: tVerify2,
		tFix: tFix2,
	});
	const costPerJob = expectedCostWithVerification({
		p,
		w: hourlyRate * tWork,
		C: C2,
		F: F2,
	});
	return { timePerJob, costPerJob };
}

// Baseline: slow dev using verifier for rework
const slowTC2 = timeCostPerJobSweep2(
	slowWorker.p,
	slowWorker.tWork,
	slowDevRate
);
const slowAttempts2 = Math.floor(
	sweep2SprintHours / slowTC2.timePerJob
);
const slowRevenue2 = slowAttempts2 * sweep2UnitPrice;
const slowTotalCost2 = slowAttempts2 * slowTC2.costPerJob;
const slowProfit2 = slowRevenue2 - slowTotalCost2;

console.log(
	`Sweep settings: P = ${sweep2UnitPrice} USD, sprint = ${sweep2SprintHours} h`
);
console.log(
	`Slow dev: p = ${slowWorker.p}, tWork = ${slowWorker.tWork} h, rate = ${slowDevRate} USD/h`
);
console.log(
	`Verifier: rate = ${verifierRate} USD/h, tVerify = ${tVerify2} h, tFix = ${tFix2} h`
);
console.log(
	`Slow attempts ≈ ${slowAttempts2}, profit ≈ ${slowProfit2.toFixed(2)} USD\n`
);

// Table header
const header2Cols = [
	"pFast",
	"tWorkFast(h)",
	"attempts",
	"profitFast",
	"Δprofit",
	"winner",
];
const header2 = header2Cols.map((h) => h.padStart(13)).join(" | ");
const separator2 = "-".repeat(header2.length);

console.log(header2);
console.log(separator2);

// Sweep pFast from "almost as reliable as slow" down to pretty sloppy
const pFastValues = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2];

for (const pFast of pFastValues) {
	// Fast dev: cheaper hourly rate and less time as pFast drops
	const tWorkFast = slowWorker.tWork * (pFast / slowWorker.p);
	const { timePerJob, costPerJob } = timeCostPerJobSweep2(
		pFast,
		tWorkFast,
		fastDevRate // scale fast dev rate down with pFast
	);

	const attemptsFast = Math.floor(
		sweep2SprintHours / timePerJob
	);
	const revenueFast = attemptsFast * sweep2UnitPrice;
	const totalCostFast = attemptsFast * costPerJob;
	const profitFast = revenueFast - totalCostFast;

	const profitDiff = profitFast - slowProfit2;
	const winner =
		Math.abs(profitDiff) < 1e-6
			? "Tie"
			: profitDiff > 0
			? "Fast"
			: "Slow";

	const row = [
		pFast.toFixed(2).padStart(13),
		tWorkFast.toFixed(2).padStart(13),
		String(attemptsFast).padStart(13),
		profitFast.toFixed(2).padStart(13),
		profitDiff.toFixed(2).padStart(13),
		winner.padStart(13),
	].join(" | ");

	console.log(row);
}

// Optional: search for the best pFast in this setup
(function findSweetSpotSweep2() {
	let best = { pFast: null, profitFast: -Infinity, attempts: 0, tWorkFast: 0 };

	for (let pFast = 0.2; pFast <= 0.95 + 1e-9; pFast += 0.01) {
		const tWorkFast = slowWorker.tWork * (pFast / slowWorker.p);
		const { timePerJob, costPerJob } = timeCostPerJobSweep2(
			pFast,
			tWorkFast,
			fastDevRate
		);
		const attemptsFast = Math.floor(
			sweep2SprintHours / timePerJob
		);
		const revenueFast = attemptsFast * sweep2UnitPrice;
		const totalCostFast = attemptsFast * costPerJob;
		const profitFast = revenueFast - totalCostFast;

		if (profitFast > best.profitFast) {
			best = { pFast, profitFast, attempts: attemptsFast, tWorkFast };
		}
	}

	console.log("\nSweet spot for Fast dev in this verifier model:");
	console.log(
		`  pFast ≈ ${best.pFast.toFixed(2)}, tWorkFast ≈ ${best.tWorkFast.toFixed(
			2
		)} h, attempts ≈ ${best.attempts}, profitFast ≈ ${best.profitFast.toFixed(
			2
		)}`
	);
	console.log(
		`  Profit advantage over Slow: ${(best.profitFast - slowProfit2).toFixed(
			2
		)} USD`
	);
})();
