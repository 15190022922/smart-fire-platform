/**
 * Include definition of class CamExporter from QCAD/CAM plugin:
 */
include("scripts/Cam/CamExport/CamExporter.js");

/**
 * \class GCode
 * This is the base class for all G-Code derived configurations.
 * Constructor of class GCode.
 */
function GCode(documentInterface, newDocumentInterface) {
    // call constructor of base class 'CamExporter':
    CamExporter.call(this, documentInterface, newDocumentInterface);

    this.toolPosition = GCode.ToolPosition.Up;
    this.alwaysWriteGCode = false;
    this.g = undefined;
    this.gPrev = undefined;
    this.i = undefined;
    this.j = undefined;
    this.f = undefined;
    this.fPrev = undefined;
    this.toolSide = undefined;
    this.toolSidePrev = undefined;

    // these need to be undefined to make sure the first move is written even if it's to 0,0:
    this.x = undefined;
    this.xPrev = undefined;
    this.y = undefined;
    this.yPrev = undefined;
    this.z = undefined;
    this.zPrev = undefined;

    this.lineNumber = 10;
    this.separator = " ";
    this.decimals = 3;
    this.trailingZeros = false;
    this.forceSign = false;
    this.useComma = false;

    this.globalOptions = "GCode";
    this.layerOptions = "GCodeLayer";
    this.absoluteIJ = false;


    // other useful member variables:
    // this.fileName: file name of exported file
}

/**
 * Configuration 'GCode' is derived from class 'CamExporter'. All configurations
 * _must_ be (indirectly) derived from this class to be valid:
 */
GCode.prototype = new CamExporter();
GCode.displayName = "GCode";

/**
 * Current mode of movement.
 */
GCode.Mode = {
    Rapid : 0,
    Normal : 1,
    CircularCW: 2,
    CircularCCW: 3
};

/**
 * Current tool position.
 */
GCode.ToolPosition = {
    Clear : 0,
    Up : 1,
    Down : 2
};

/**
 * Lead in/out type. These numbers are saved in documents.
 * Changing values will break backwards compatibility.
 */
GCode.LeadType = {
    None : 0,
    Normal : 1,
    Angular : 2,
    Extension : 3
};

/**
 * Lead in/out side. These numbers are saved in documents.
 * Changing values will break backwards compatibility.
 */
GCode.LeadSide = {
    Left : 1,
    Right : 2
};

/**
 * Initializes the CAM export dialog d.
 */
GCode.prototype.initDialog = function(d) {
    // widgets might be disabled, added, decorated, etc. here:
    //d.findChild("GroupGeneral").visible = false;
};

/**
 * Initializes the widget with global options (top-right of the CAM 
 * export dialog).
 *
 * \param w The widget containing all the option controls (line edits, 
 * combo boxes, etc)
 */
GCode.prototype.initGlobalOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZSafety":
        w.addItems(["200", "150", "100", "50"]);
        w.setEditText("100");
        break;
    case "ZClear":
        w.addItems(["1", "2", "3"]);
        w.setEditText("2");
        break;
    case "ZCutting":
        w.addItems(["-1", "-2", "-3"]);
        w.setEditText("-2");
        break;
    case "Feedrate":
        w.addItems(["100", "200", "300"]);
        w.setEditText("200");
        break;
    }
};

/**
 * Initializes the widget with layer specific options (bottom-right of 
 * the CAM export dialog).
 *
 * \param w The widget containing all the option controls (line edits, 
 * combo boxes, etc)
 */
GCode.prototype.initLayerOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZCutting":
        w.addItems(["default", "-1", "-2", "-3"]);
        w.setEditText("default");
        break;
    }
};

/**
 * \return Array of file extensions which can be used for the exported file.
 * The user can choose the desired extension when exporting a gile.
 */
GCode.prototype.getFileExtensions = function() {
    return ["nc"];
};

/**
 * \return G-Code for linear rapid movements.
 */
GCode.prototype.getRapidMoveCode = function() {
    return "G00";
};

/**
 * \return Text string to be appended to lines with rapid moves.
 */
GCode.prototype.getRapidMoveCodePostfix = function() {
    return "";
};

/**
 * \return G-Code for linear movements.
 */
GCode.prototype.getLinearMoveCode = function() {
    return "G01";
};

/**
 * \return Text string to be appended to lines with linear moves.
 */
GCode.prototype.getLinearMoveCodePostfix = function() {
    return "";
};

/**
 * \return G-Code for clockwise circular movements.
 */
GCode.prototype.getCircularCWMoveCode = function() {
    return "G02";
};

/**
 * \return Text string to be appended to lines with clockwise circular moves.
 */
GCode.prototype.getCircularCWMoveCodePostfix = function() {
    return "";
};

/**
 * \return G-Code for counter-clockwise circular movements.
 */
GCode.prototype.getCircularCCWMoveCode = function() {
    return "G03";
};

/**
 * \return Text string to be appended to lines with counter-clockwise circular moves.
 */
GCode.prototype.getCircularCCWMoveCodePostfix = function() {
    return "";
};

/**
 * \return First word to be output per line, usually a number code.
 */
GCode.prototype.getLineNumberCode = function() {
    if (isNull(this.lineNumber)) {
        return "";
    }

    var ret = sprintf("N%d", this.lineNumber);
    this.lineNumber += 10;
    return ret;
};

/**
 * \return G-Code to specify X coordinate for the given value.
 */
GCode.prototype.getXCode = function(value) {
    var v = value;
    if (this.getIncrementalXYZ() && !isNull(this.xPrev)) {
        v -= this.xPrev;
    }
    return "X" + this.formatNumber(v);
};

/**
 * \return G-Code to specify Y coordinate for the given value.
 */
GCode.prototype.getYCode = function(value) {
    var v = value;
    if (this.getIncrementalXYZ() && !isNull(this.yPrev)) {
        v -= this.yPrev;
    }
    return "Y" + this.formatNumber(v);
};

/**
 * \return G-Code to specify Z level for the given value.
 */
GCode.prototype.getZCode = function(value) {
    var v = value;
    if (this.getIncrementalXYZ() && !isNull(this.zPrev)) {
        v -= this.zPrev;
    }
    return "Z" + this.formatNumber(v);
};

/**
 * \return G-Code to specify I coordinate for the given value.
 */
GCode.prototype.getICode = function(value) {
    return "I" + this.formatNumber(value);
};

/**
 * \return G-Code to specify J coordinate for the given value.
 */
GCode.prototype.getJCode = function(value) {
    return "J" + this.formatNumber(value);
};

/**
 * \return String representing the given number 
 * (e.g. "1.235" for a value of 1.234567).
 */
GCode.prototype.formatNumber = function(value) {
    var format;
    if (this.forceSign===true) {
        format = "%+.%1f".arg(this.decimals);
    }
    else {
        format = "%.%1f".arg(this.decimals);
    }

    // sprintf2 supports sign, trailing zeros:
    var ret = sprintf2(format, value);
    if (this.useComma===true) {
        ret = ret.replace(".", ",");
    }

    if (this.trailingZeros===false) {
        // strip trailing zeros ('1.000' -> '1'):
        ret = RMath.trimTrailingZeroes(ret);
    }

    return ret;
};

/**
 * \return G-Code to specify F (feedrate change) for the given value.
 */
GCode.prototype.getFCode = function(value) {
    if (!isNumber(value)) {
        return undefined;
    }

    return sprintf("F%f", value);
};

/**
 * \return G-Code to specify tool radius compensation for the given side value 
 * (RS.LeftHand for G41, RS.RightHand for G42 or RS.NoSide for G40).
 */
GCode.prototype.getSideCode = function(value) {
    if (value===RS.LeftHand) {
        return "G41";
    }
    else if (value===RS.RightHand) {
        return "G42";
    }
    else if (value===RS.NoSide) {
        return "G40";
    }
    else {
        return undefined;
    }
};

GCode.prototype.getSideCodePostfix = function(value) {
    return undefined;
};

/**
 * \return Z level to be used to retreat to safety level.
 */
GCode.prototype.getSafetyZLevel = function() {
    return parseFloat(this.getGlobalOption("ZSafety", 100.0));
};

/**
 * \return Z level to be used to retreat for rapid moves.
 */
GCode.prototype.getToolUpLevel = function() {
    return parseFloat(this.getGlobalOption("ZClear", 2.0));
};

/**
 * \return Z level to be used for cutting.
 * May depend on current layer, current entity, etc.
 */
GCode.prototype.getToolDownLevel = function() {
    var docValue = parseFloat(this.getGlobalOption("ZCutting", -1.0));
    return parseFloat(this.getLayerOption("ZCutting", docValue));
};

/**
 * \return Current feedrate value. 
 * May depend on current layer, current entity, etc.
 */
GCode.prototype.getFeedrate = function() {
    return parseFloat(this.getGlobalOption("Feedrate", 200));
};

/**
 * \return True if tool is currently up, laser is off, water jet is off, etc. 
 * False otherwise.
 */
GCode.prototype.toolIsUp = function() {
    this.g = GCode.Mode.Rapid;
    this.toolPosition = GCode.ToolPosition.Up;
};

/**
 * \return True if tool is currently down, laser is on, water jet is on, etc. 
 * False otherwise.
 */
GCode.prototype.toolIsDown = function() {
    this.g = GCode.Mode.Normal;
    this.toolPosition = GCode.ToolPosition.Down;
};

/**
 * Writes the line(s) to stop cutting and moving the tool up, switching laser off, etc.
 */
GCode.prototype.writeToolUp = function() {
    this.g = GCode.Mode.Normal;
    this.z = this.getToolUpLevel();
    this.toolPosition = GCode.ToolPosition.Up;
    if (this.feedRateSet!==true) {
        var f = this.getFeedrate();
        if (isNumber(f)) {
            this.writeLine(undefined, this.getFCode(f));
        }
        this.feedRateSet=true;
    }
    else {
        this.writeLine();
    }
    this.toolIsUp();
};

/**
 * Writes the line(s) to start cutting and moving the tool down, switching laser on, etc.
 */
GCode.prototype.writeToolDown = function() {
    this.g = GCode.Mode.Normal;
    this.z = this.getToolDownLevel();
    this.toolPosition = GCode.ToolPosition.Down;
    this.writeLine();
    this.toolIsDown();
};

/**
 * Writes the line(s) to move to the given Z level using a rapid movement.
 */
GCode.prototype.writeRapidZMove = function(z) {
    this.g = GCode.Mode.Rapid;
    this.z = z;
    this.writeLine();
};

/**
 * Writes the line(s) to move to the given Z level using a movement with the current feedrate.
 */
GCode.prototype.writeZMove = function(z) {
    this.g = GCode.Mode.Normal;
    this.z = z;
    this.writeLine();
};

/**
 * Writes the line(s) to move rapidly to the given coordinate.
 */
GCode.prototype.writeRapidLinearMove = function(x, y) {
    if (!this.gotXMove(x) && !this.gotYMove(y)) {
        return;
    }

    this.writeBeforeRapidLinearMove(x, y);

    // force tool up before Rapid move:
    if (this.toolPosition !== GCode.ToolPosition.Up && this.toolPosition !== GCode.ToolPosition.Clear) {
        this.writeToolUp();
    }

    this.g = GCode.Mode.Rapid;
    this.x = x;
    this.y = y;
    this.writeLine();

    this.writeAfterRapidLinearMove(x, y);
};

/**
 * Writes the line(s) before moving rapidly to the given coordinate.
 */
GCode.prototype.writeBeforeRapidLinearMove = function(x, y) { };

/**
 * Writes the line(s) after moving rapidly to the given coordinate.
 */
GCode.prototype.writeAfterRapidLinearMove = function(x, y) { };

/**
 * Called before cutting starts (before G01, G02, G03).
 * Expected to move tool down, switch laser on, etc.
 */
GCode.prototype.prepareForCutting = function() {
    // force tool down before normal move:
    if (this.toolPosition !== GCode.ToolPosition.Down) {
        // force tool up before tool down:
        if (this.toolPosition !== GCode.ToolPosition.Up) {
            this.writeToolUp();
        }
    }
    // always adjust Z-level if necessary (allow for mid-contour Z level changes)
    this.writeToolDown();
};

/**
 * Writes the line(s) for a linear move (G01) to the given coordinate.
 */
GCode.prototype.writeLinearMove = function(x, y) {
    this.prepareForCutting();

    this.g = GCode.Mode.Normal;
    this.x = x;
    this.y = y;
    this.writeLine();
};

/**
 * Writes the line(s) for a circular move (G02, G03) to the given coordinate.
 *
 * \param center Center of arc.
 * \param radius Radius of arc.
 * \param startAngle Start angle of arc in rad.
 * \param endAngle End angle of arc in rad.
 * \param isLarge True if te arc sweep is larger than 180 degrees.
 * \param isReversed True if arc is clockwise (reversed).
 */
GCode.prototype.writeCircularMove = function(x, y,
    center, radius,
    startAngle, endAngle,
    isLarge, isReversed) {

    this.prepareForCutting();

    if (isReversed) {
        this.g = GCode.Mode.CircularCW;
    }
    else {
        this.g = GCode.Mode.CircularCCW;
    }

    if (this.absoluteIJ) {
        this.i = center.x;
        this.j = center.y;
    }
    else {
        this.i = center.x - this.x;
        this.j = center.y - this.y;
    }
    this.x = x;
    this.y = y;
    this.writeLine();
};

/**
 * Writes the header of the exported file (initialization, etc).
 */
GCode.prototype.writeHeader = function() {
    this.writeRapidMoveToSafetyLevel();
};

GCode.prototype.writeRapidMoveToSafetyLevel = function() {
    this.writeRapidZMove(this.getSafetyZLevel());
    this.toolPosition = GCode.ToolPosition.Clear;
};

/**
 * Writes the footer of the exported file.
 */
GCode.prototype.writeFooter = function() {
    this.writeToolUp();
    this.writeRapidZMove(this.getSafetyZLevel());
    this.toolPosition = GCode.ToolPosition.Clear;
    this.writeLine("M30");
};

/**
 * \return True if the given mode (G00, G01, G02) is different from the current mode.
 * Always returns true if this.alwaysWriteGCode is true.
 */
GCode.prototype.gotModeChange = function(m) {
    return this.alwaysWriteGCode || (isNull(this.gPrev) && !isNull(m)) || (!isNull(m) && this.gPrev!=m);
};

/**
 * \return True if the given X position is different from the current X position.
 */
GCode.prototype.gotXMove = function(x) {
    return (isNull(this.xPrev) && !isNull(x)) || (!isNull(x) && !this.fuzzyCompare(x, this.xPrev));
};

/**
 * \return True if the given Y position is different from the current Y position.
 */
GCode.prototype.gotYMove = function(y) {
    return (isNull(this.yPrev) && !isNull(y)) || (!isNull(y) && !this.fuzzyCompare(y, this.yPrev));
};

/**
 * \return True if the given Z position is different from the current Z position.
 */
GCode.prototype.gotZMove = function(z) {
    return (isNull(this.zPrev) && !isNull(z)) || (!isNull(z) && !this.fuzzyCompare(z, this.zPrev));
};

//GCode.prototype.gotZUpMove = function(z) {
//    return this.gotZMove(z) && z>this.zPrev;
//};

/**
 * \return True if the given feedrate is different from the current feedrate.
 */
GCode.prototype.gotFeedrateChange = function(f) {
    return (isNull(this.fPrev) && !isNull(f)) || (!isNull(f) && f!==this.fPrev);
};

/**
 * \return True if the given side is different from the current side for tool radius compensation.
 */
GCode.prototype.gotSideChange = function(side) {
    return (isNull(this.toolSidePrev) && !isNull(side)) || (!isNull(side) && side!==this.toolSidePrev);
};

/**
 * \return True if the given entity is preceded by a lead in shape.
 */
GCode.prototype.hasLeadIn = function(entity) {
    var leadInShape = this.getLeadInShape(entity);
    return !isNull(leadInShape);
};

/**
 * \return True if the given entity is followed by a lead out shape.
 */
GCode.prototype.hasLeadOut = function(entity) {
    var leadOutShape = this.getLeadOutShape(entity);
    return !isNull(leadOutShape);
};

/**
 * Called to export lead in for given entity.
 */
GCode.prototype.exportLeadIn = function(entity) {
    // get side of tool radius compensation to be
    // applied to lead in or entity self:
    this.toolSide = this.getLeadInSide(entity);

    // process lead in if appropriate:
    var leadInShape = this.getLeadInShape(entity);
    if (!isNull(leadInShape)) {
        var leadInEntity = shapeToEntity(this.getDocument(), leadInShape);
        // make sure entity is on current block:
        leadInEntity.copyAttributesFrom(getPtr(entity));
        this.exportContourEntity(leadInEntity, undefined, undefined);
        this.toolSidePrev = this.toolSide;
    }
};

/**
 * Called to export lead out for given entity.
 */
GCode.prototype.exportLeadOut = function(entity) {
    var leadOutShape = this.getLeadOutShape(entity);
    if (!isNull(leadOutShape)) {
        var leadOutEntity = shapeToEntity(this.getDocument(), leadOutShape);
        // make sure entity is on current block:
        leadOutEntity.copyAttributesFrom(getPtr(entity));
        this.toolSide = RS.NoSide;
        this.exportContourEntity(leadOutEntity, undefined, undefined);
        this.toolSidePrev = RS.NoSide;
    }
    else {
        this.toolSide = RS.NoSide;
    }
};

/**
 * \return Desired side for radius compensation for the given entity.
 */
GCode.prototype.getLeadInSide = function(entity) {
    return parseInt(this.getEntityOption(entity, "CamLeadInSide"));
};

/**
 * \return Lead in shape for given entity.
 */
GCode.prototype.getLeadInShape = function(entity) {
    return this.getLeadShape(entity, true);
};

/**
 * \return Lead out shape for given entity.
 */
GCode.prototype.getLeadOutShape = function(entity) {
    return this.getLeadShape(entity, false);
};

/**
 * \return Lead in / lead out shape for given entity.
 */
GCode.prototype.getLeadShape = function(entity, leadIn) {
    if (isNull(leadIn)) {
        leadIn = true;
    }

    var leadType, leadSize, leadSide, leadAngle;
    if (leadIn) {
        leadType = this.getEntityOption(entity, "CamLeadInType");
        leadSize = this.getEntityOption(entity, "CamLeadInSize");
        leadSide = this.getEntityOption(entity, "CamLeadInSide");
        leadAngle = this.getEntityOption(entity, "CamLeadInAngle");
    }
    else {
        leadType = this.getEntityOption(entity, "CamLeadOutType");
        leadSize = this.getEntityOption(entity, "CamLeadOutSize");
        leadSide = this.getEntityOption(entity, "CamLeadOutSide");
        leadAngle = this.getEntityOption(entity, "CamLeadOutAngle");
    }

    if (isNull(leadType) || isNull(leadSize) || isNull(leadSide)) {
        return undefined;
    }

    leadType = parseInt(leadType);
    leadSize = parseFloat(leadSize);
    leadSide = parseInt(leadSide);

    if (leadType===GCode.LeadType.Angular && isNull(leadAngle)) {
        return undefined;
    }

    leadAngle = parseFloat(leadAngle);

    if (leadSide!==GCode.LeadSide.Left && leadSide!==GCode.LeadSide.Right) {
        // invalid lead in:
        return undefined;
    }

//    qDebug("type: ", leadType);
//    qDebug("size: ", leadSize);
//    qDebug("side: ", leadSide);
//    qDebug("angle: ", leadAngle);

    var ret = undefined;
    var angle;
    var dir;
    if (leadIn) {
        dir = entity.getDirection1();
    }
    else {
        dir = entity.getDirection2() + Math.PI;
    }

    var p;
    if (leadIn) {
        p = entity.getStartPoint();
    }
    else {
        p = entity.getEndPoint();
    }

    var sp;

    if (leadType===GCode.LeadType.Extension) {
        angle = dir + Math.PI;
        sp = p.operator_add(RVector.createPolar(leadSize, angle));
        ret = new RLine(sp, p);
    }
    else {
        // left:
        if (leadSide===GCode.LeadSide.Left) {
            angle = dir + Math.PI/2;
        }
        // right:
        else {
            angle = dir - Math.PI/2;
        }

        if (leadType===GCode.LeadType.Angular) {
            // create arc
            sp = p.operator_add(RVector.createPolar(leadSize, angle));
            ret = new RArc(sp, sp.getDistanceTo(p), 0, 2*Math.PI, false);
            if (leadSide===GCode.LeadSide.Left) {
                ret.setReversed(false);
                ret.setEndAngle(sp.getAngleTo(p));
                ret.setStartAngle(ret.getEndAngle() - leadAngle);
            }
            else {
                ret.setReversed(true);
                ret.setEndAngle(sp.getAngleTo(p));
                ret.setStartAngle(ret.getEndAngle() + leadAngle);
            }
        }
        else if (leadType===GCode.LeadType.Normal) {
            sp = p.operator_add(RVector.createPolar(leadSize, angle));
            ret = new RLine(sp, p);
        }
    }

    if (!leadIn && !isNull(ret)) {
        ret.mirror(new RLine(p, p.operator_add(RVector.createPolar(1, dir-Math.PI/2))));
        ret.reverse();
    }

    return ret;
};

/**
 * Called for first entity of a contour.
 */
GCode.prototype.exportFirstContourEntity = function(entity, rampOnPoint, rampOffPoint) {
    this.exportLeadIn(entity);
    if (this.hasLeadIn(entity)) {
        rampOnPoint = undefined;
    }
    this.exportContourEntity(entity, rampOnPoint, rampOffPoint);
};

/**
 * Called for last entity of a contour.
 */
GCode.prototype.exportLastContourEntity = function(entity, rampOnPoint, rampOffPoint) {
    if (this.hasLeadOut(entity)) {
        rampOffPoint = undefined;
    }
    this.exportContourEntity(entity, rampOnPoint, rampOffPoint);
    this.exportLeadOut(entity);
};

/**
 * Called for contours consisting of one single entity (e.g. full circle).
 */
GCode.prototype.exportSingleContourEntity = function(entity, rampOnPoint, rampOffPoint) {
    this.orientation = this.getPathOrientation();

    this.exportLeadIn(entity);
    if (this.hasLeadIn(entity)) {
        rampOnPoint = undefined;
    }
    if (this.hasLeadOut(entity)) {
        rampOffPoint = undefined;
    }
    this.exportContourEntity(entity, rampOnPoint, rampOffPoint);
    this.exportLeadOut(entity);
};

/**
 * \return Layer ID of layer for rapid moves visualizations in output document.
 */
GCode.prototype.getCamLayerId = function() {
    if (this.duringRapidMove===true) {
        return CamExporter.prototype.getCamLayerId.call(this);
    }

    return this.createLayer("cut at " + this.getToolDownLevel(), new RColor("white"));
};

/**
 * \return String consisting of given line and string, separated by this.separator.
 */
GCode.prototype.append = function(line, str) {
    if (isNull(str) || str.length===0) {
        return line;
    }

    if (line.length===0) {
        return str;
    }
    else {
        return line + this.separator + str;
    }
};

/**
 * Includes the given file into the output. This is typically used for
 * complex headers or footers.
 *
 * The included file may contain the following place holders:
 * $$FILENAME$$ Replaced with name of drawing that is being exported
 * $$LINE$$ Replaced by the current line number
 */
GCode.prototype.include = function(fileName) {
    var file = new QFile(fileName);
    var flags = makeQIODeviceOpenMode(QIODevice.ReadOnly, QIODevice.Text);
    var contents;
    if (file.open(flags)) {
        contents = file.readAll().toString();
        file.close();
    }

    // replace variables:
    contents = contents.replace("$$FILENAME$$", new QFileInfo(this.fileName).absoluteFilePath());

    contents = contents.split("\n");
    for (var i=0; i<contents.length-1; i++) {
        // replace line numbers
        contents[i] = contents[i].replace("$$LINE$$", this.lineNumber);
        qDebug("header line: ", contents[i]);
        this.writeLine(contents[i]);
    }
};

/**
 * Writes a comment to the output file (a line starting with ;).
 */
GCode.prototype.writeComment = function(text) {
    CamExporter.prototype.writeLine.call(this, "; " + text);
};

/**
 * \return Tool to be used for the given entity.
 */
GCode.prototype.getTool = function(entity) {
    return this.getEntityOption(entity, "CamTool");
};

/**
 * Writes a tool change (M6 T..) to the output file.
 */
GCode.prototype.writeToolChange = function(toolName) {
    this.writeRapidMoveToSafetyLevel();
    this.writeLine("M6 T" + toolName);
};

/**
 * Writes the next line of the file or the given custom line with line nummer.
 *
 * \param custom string (optional) custom line contents
 * \param append string (optional) append to line contents
 */
GCode.prototype.writeLine = function(custom, append) {
    var line = "";

    if (!isNull(custom)) {
        line = this.getLineNumberCode();
        line = this.append(line, custom);
        CamExporter.prototype.writeLine.call(this, line);
        return;
    }

    var gotModeChange = this.gotModeChange(this.g);
    var gotXMove = this.gotXMove(this.x);
    var gotYMove = this.gotYMove(this.y);
    var gotZMove = this.gotZMove(this.z);
    var gotFeedrateChange = this.gotFeedrateChange(this.f);
    var gotSideChange = this.gotSideChange(this.toolSide);

    // nothing to do:
    if (this.g!==GCode.Mode.CircularCW && this.g!==GCode.Mode.CircularCCW &&
        !gotXMove && !gotYMove && !gotZMove && !gotFeedrateChange) {
        return;
    }

    line = this.getLineNumberCode();

    // G41, G42, G40:
    var sideCodePostfix = undefined;
    if (gotSideChange && this.g!==GCode.Mode.Rapid && (gotXMove || gotYMove)) {
        var sideCode = this.getSideCode(this.toolSide);
        sideCodePostfix = this.getSideCodePostfix(this.toolSide);
        if (!isNull(sideCode)) {
            line = this.append(line, sideCode);
            this.toolSidePrev = this.toolSide;
        }
    }

    switch (this.g) {
    case GCode.Mode.Rapid:
        if (gotModeChange) {
            line = this.append(line, this.getRapidMoveCode());
        }
        break;
    case GCode.Mode.Normal:
        if (gotModeChange) {
            line = this.append(line, this.getLinearMoveCode());
        }
        break;
    case GCode.Mode.CircularCW:
        line = this.append(line, this.getCircularCWMoveCode());
        break;
    case GCode.Mode.CircularCCW:
        line = this.append(line, this.getCircularCCWMoveCode());
        break;
    }

    if (gotXMove || this.g===GCode.Mode.CircularCW || this.g===GCode.Mode.CircularCCW) {
        line = this.append(line, this.getXCode(this.x));
    }

    if (gotYMove || this.g===GCode.Mode.CircularCW || this.g===GCode.Mode.CircularCCW) {
        line = this.append(line, this.getYCode(this.y));
    }

    if (gotZMove) {
        line = this.append(line, this.getZCode(this.z));
    }

    if (this.g===GCode.Mode.CircularCW || this.g===GCode.Mode.CircularCCW) {
        line = this.append(line, this.getICode(this.i));
        line = this.append(line, this.getJCode(this.j));
    }

    if (gotFeedrateChange) {
        var fCode = this.getFCode(this.f);
        if (!isNull(fCode)) {
            line = this.append(line, fCode);
            this.fPrev = this.f;
        }
    }

    switch (this.g) {
    case GCode.Mode.Rapid:
        line = this.append(line, this.getRapidMoveCodePostfix());
        break;
    case GCode.Mode.Normal:
        line = this.append(line, this.getLinearMoveCodePostfix());
        break;
    case GCode.Mode.CircularCW:
        line = this.append(line, this.getCircularCWMoveCodePostfix());
        break;
    case GCode.Mode.CircularCCW:
        line = this.append(line, this.getCircularCCWMoveCodePostfix());
        break;
    }

    if (!isNull(sideCodePostfix)) {
        line = this.append(line, sideCodePostfix);
    }

    if (!isNull(append)) {
        line = this.append(line, append);
    }

    CamExporter.prototype.writeLine.call(this, line);

    this.xPrev = this.x;
    this.yPrev = this.y;
    this.zPrev = this.z;
    this.gPrev = this.g;
};
