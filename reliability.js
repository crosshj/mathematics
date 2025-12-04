/**
 * Reliability economics model (JS version)
 *
 * Variables:
 * - p : probability a worker/tool does a job correctly on first try
 * - B : benefit of a correct job
 * - L : loss when a wrong job slips through undetected
 * - C : cost to verify a job (review/tests)
 * - F : cost to fix a job after verification finds an error
 * - w : cost (wage/price) to have a worker/tool attempt the job once
 */


console.log('\n\n\n')

// ---------------------------------------------------------------------------
// 1. Expected value when you TRUST the output (no mandatory verification)
// ---------------------------------------------------------------------------

function expectedValueTrust({ p, B, L }) {
	// EV_trust = p * B - (1 - p) * L
	return p * B - (1 - p) * L;
}

// ---------------------------------------------------------------------------
// 2. Expected value when you ALWAYS VERIFY before accepting the work
// ---------------------------------------------------------------------------

function expectedValueVerify({ p, B, C, F }) {
	// EV_verify = B - C - (1 - p) * F
	return B - C - (1 - p) * F;
}

// ---------------------------------------------------------------------------
// 3. Expected COST when you require a correct outcome (mandatory verification)
// ---------------------------------------------------------------------------

function expectedCostWithVerification({ p, w, C, F }) {
	// Cost_with_verification = w + C + (1 - p) * F
	return w + C + (1 - p) * F;
}

// ---------------------------------------------------------------------------
// 4. Comparing two workers/tools under the SAME verification policy
// ---------------------------------------------------------------------------

function compareWorkersWithVerification(workerA, workerB, shared) {
	const costA = expectedCostWithVerification({
		p: workerA.p,
		w: workerA.w,
		C: shared.C,
		F: shared.F,
	});

	const costB = expectedCostWithVerification({
		p: workerB.p,
		w: workerB.w,
		C: shared.C,
		F: shared.F,
	});

	if (Math.abs(costA - costB) < 1e-9) {
		return { cheaper: null, costA, costB, diff: 0 };
	}

	if (costA < costB) {
		return { cheaper: "A", costA, costB, diff: costB - costA };
	}

	return { cheaper: "B", costA, costB, diff: costA - costB };
}

// ---------------------------------------------------------------------------
// 5. How much extra can you justify paying for a more reliable worker?
// ---------------------------------------------------------------------------

function maxWagePremiumForHigherReliability({ pLow, pHigh, F }) {
	// maxPremium = (pHigh - pLow) * F
	return (pHigh - pLow) * F;
}

// ---------------------------------------------------------------------------
// 6. Demo: 70% worker vs 80% worker under mandatory verification
// ---------------------------------------------------------------------------

const worker70 = { label: "Worker 70%", p: 0.7, w: 50 };
const worker80 = { label: "Worker 80%", p: 0.8, w: 60 };

const shared = {
	C: 20,  // verification cost
	F: 100, // fix/rework cost when wrong
};

console.log("=== Scenario: mandatory verification for each job ===\n");

console.log("Parameters:");
console.log(`  Verification cost (C): ${shared.C}`);
console.log(`  Fix cost when wrong (F): ${shared.F}\n`);

console.log("Workers:");
console.log(
	`  ${worker70.label}: p = ${worker70.p}, wage (w) = ${worker70.w}`
);
console.log(
	`  ${worker80.label}: p = ${worker80.p}, wage (w) = ${worker80.w}\n`
);

// Compute expected cost per finished-correct job for each worker
const cost70 = expectedCostWithVerification({
	p: worker70.p,
	w: worker70.w,
	C: shared.C,
	F: shared.F,
});
const cost80 = expectedCostWithVerification({
	p: worker80.p,
	w: worker80.w,
	C: shared.C,
	F: shared.F,
});

console.log("Expected cost per finished correct job:");
console.log(`  ${worker70.label}: ${cost70}`);
console.log(`  ${worker80.label}: ${cost80}\n`);

const comparison = compareWorkersWithVerification(worker70, worker80, shared);

console.log("Comparison result:");
if (comparison.cheaper === null) {
	console.log("  Both workers have the same expected cost.");
} else {
	const cheaperLabel =
		comparison.cheaper === "A" ? worker70.label : worker80.label;
	console.log(`  Cheaper worker: ${cheaperLabel}`);
	console.log(`  Cost difference: ${comparison.diff}`);
}
console.log();

const premium = maxWagePremiumForHigherReliability({
	pLow: worker70.p,
	pHigh: worker80.p,
	F: shared.F,
});

console.log("Reliability premium calculation:");
console.log(
	`  Max extra wage you can justify for the 80% worker over the 70% worker: ${premium}`
);
console.log(
	"  (If the actual wage gap is larger than this, you're overpaying for reliability under this model.)"
);


console.log('\n\n\n')