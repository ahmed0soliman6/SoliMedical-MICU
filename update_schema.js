const fs = require('fs');
let content = fs.readFileSync('src/types/schema.ts', 'utf8');

// The file currently has a mix of new models and old models.
// Let's restore the enums for now, and update PatientDossier to be PatientRecord with all fields.
