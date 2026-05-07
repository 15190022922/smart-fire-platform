include("scripts/Cam/CamExportV2/CamExporterV2.js");

function None(cadDocumentInterface, camDocumentInterface) {
    CamExporterV2.call(this, cadDocumentInterface, camDocumentInterface);

    if (isNull(cadDocumentInterface)) {
        // constructor used as prototype:
        return;
    }
}

None.prototype = new CamExporterV2();
None.displayName = "None";
None.description = "No post processor chosen";
