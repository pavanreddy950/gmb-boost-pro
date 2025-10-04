// Trusted Types policy for Azure Static Web Apps
// This allows dynamic script loading which Azure blocks by default

if (typeof window !== 'undefined' && window.trustedTypes) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (input) => input,
      createScript: (input) => input,
      createScriptURL: (input) => input,
    });
    console.log('✅ Trusted Types policy created');
  } catch (e) {
    // Policy might already exist
    console.log('ℹ️ Trusted Types policy already exists or not needed');
  }
}
