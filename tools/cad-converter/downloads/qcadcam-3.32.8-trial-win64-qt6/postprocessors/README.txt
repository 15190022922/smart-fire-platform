Please do not edit the files in this directory.
Instead, always create a new file with a new, unique name for custom postprocessors.

For example, create a file MyGCode.js with contents (without the lines starting with --):

-- file MyGCode.js --
include("GCodeBase.js");

function MyGCode(cadDocumentInterface, camDocumentInterface) {
    GCodeBase.call(this, cadDocumentInterface, camDocumentInterface);

    this.decimals = 4;
    this.unit = RS.Millimeter;
}

MyGCode.prototype = new GCodeBase();

MyGCode.displayName = "My G-Code [mm]";
-- end --
