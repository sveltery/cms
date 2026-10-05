const phases = ['services', 'source', 'hosting'];
const results = process.argv.slice(2);

if (results.length !== phases.length) {
  console.error('Validation requires exactly three mandatory job results: services, source, hosting');
  process.exit(1);
}

const failures = phases.flatMap((phase, index) => results[index] === 'success'
  ? []
  : [`Mandatory validation phase ${phase} did not succeed: ${results[index] || '(missing)'}`]);
if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('All mandatory validation phases succeeded: services, source, hosting');
