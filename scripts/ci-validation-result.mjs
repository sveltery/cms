const phases = ['services', 'source', 'hosting'];
const results = process.argv.slice(2);

if (results.length !== phases.length) {
  console.error('Validation requires exactly three mandatory job results: services, source, hosting');
  process.exit(1);
}

let failed = false;
for (let index = 0; index < phases.length; index += 1) {
  const result = results[index];
  if (result !== 'success') {
    console.error(`Mandatory validation phase ${phases[index]} did not succeed: ${result || '(missing)'}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('All mandatory validation phases succeeded: services, source, hosting');
