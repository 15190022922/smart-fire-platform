/**
 * This file is part of the QCAD/CAM software.
 * This file is a modified version of GCodeLaserOffset.js postprocessor file. 
 * Modified by Arctic_Eddie and corrected/improved by CVH.
 * You can edit this file. Be sure to put a copy someplace safe for the next update. 
 * Copy this file into QCADCAM/postprocessors.
 * For details, please refer to the file README.txt in this directory.
 */
include("GCodeBase.js");

function AnilamLaser(documentInterface, camDocumentInterface) {
    GCodeBase.call(this, documentInterface, camDocumentInterface);

    this.outputOffsetPath = false;      // Offset done by calculation in QCAM tool path profile

    // disable all Z moves:
    this.rapidMoveZ = [];
    this.firstLinearMoveZ = [];
    this.linearMoveZ = [];
    this.firstPointMoveZ = [];
    this.pointMoveZ = [];

    // stop cutting at tab:
    this.stopAtTab = true;

    // disable tool changes:
    this.toolHeader = [];
}

AnilamLaser.prototype = new GCodeBase();
AnilamLaser.displayName = "";

// don't change this.lastMoveGCode for Z moves:
AnilamLaser.prototype.writeFirstLinearMoveZ = function() {};
AnilamLaser.prototype.writeLinearMoveZ = function() {};
AnilamLaser.prototype.writeFirstPointMoveZ = function() {};
AnilamLaser.prototype.writePointMoveZ = function() {};

/**
 * Initializes the pass headers / footers to switch LASER on / off
 * based on the users postprocessor preferences.
 */
AnilamLaser.prototype.writeFile = function(fileName) {
    // get configured values:
    var laserOnCode = this.getGlobalOption("CamLaserOnCode", "M01");
    var laserOffCode = this.getGlobalOption("CamLaserOffCode", "M02");

    // initialize G-Code blocks for pass header (LASER on):
    if (laserOnCode.length===0) {
        this.zPassHeader = [];
    }
    else {
        this.zPassHeader = [ "[N] " + laserOnCode];
    }
    this.zPassFirstHeader = this.zPassHeader;

    // initialize G-Code blocks for pass footer (LASER off):
    if (laserOffCode.length===0) {
        this.zPassFooter = [];
    }
    else {
        this.zPassFooter = [ "[N] " + laserOffCode];
    }
    this.zPassLastFooter = this.zPassFooter;

    // call base implementation of writeFile:
    return GCodeBase.prototype.writeFile.call(this, fileName);
};

/**
 * Adds controls to the postprocessor configuration dialog to
 * configure LASER on / off G-Codes.
 */
AnilamLaser.prototype.initConfigDialog = function(dialog) {
    // add options for laser on / off:
    var group = dialog.findChild("GroupCustom");
    group.title = qsTr("LASER Controller");

    // get QVBoxLayout:
    var vBoxLayout = group.layout();

    // add label and combo box to choose LASER on / off codes:
    var hBoxLayout = new QHBoxLayout(null);
    vBoxLayout.addLayout(hBoxLayout, 0);

    var lLaserOn = new QLabel(qsTr("LASER on:"));
    hBoxLayout.addWidget(lLaserOn, 0,0);

    var cbLaserOn = new QComboBox();
    cbLaserOn.editable = true;
    cbLaserOn.objectName = "CamLaserOnCode";
    cbLaserOn.addItem("M01");
    // cbLaserOn.addItem("S255 M01");       // Power set externally
    // cbLaserOn.addItem("S255");
    hBoxLayout.addWidget(cbLaserOn, 0,0);

    hBoxLayout = new QHBoxLayout(null);
    vBoxLayout.addLayout(hBoxLayout, 0);

    var lLaserOff = new QLabel(qsTr("LASER off:"));
    hBoxLayout.addWidget(lLaserOff, 0,0);

    var cbLaserOff = new QComboBox();
    cbLaserOff.editable = true;
    cbLaserOff.objectName = "CamLaserOffCode";
    cbLaserOff.addItem("M02");
    // cbLaserOff.addItem("S0 M02");        // Power set externally
    // cbLaserOff.addItem("S0");
    hBoxLayout.addWidget(cbLaserOff, 0,0);
};

