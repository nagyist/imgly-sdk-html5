"use strict";
/*!
 * Copyright (c) 2013-2015 9elements GmbH
 *
 * Released under Attribution-NonCommercial 3.0 Unported
 * http://creativecommons.org/licenses/by-nc/3.0/
 *
 * For commercial use, please contact us at contact@9elements.com
 */

import EventEmitter from "../../../lib/event-emitter";
import Utils from "../../../lib/utils";
import Color from "../../../lib/color";
import _ from "lodash";

let fs = require("fs");

class ColorPicker extends EventEmitter {
  constructor (ui, element) {
    super();

    this._ui = ui;
    this._element = element;
    this._currentColorCanvas = this._element.querySelector(".imglykit-color-picker-color");

    this._alphaCanvas = this._element.querySelector("canvas.imglykit-color-picker-alpha");
    this._alphaKnob = this._element.querySelector(".imglykit-color-picker-alpha-container .imglykit-transparent-knob");

    this._hueCanvas = this._element.querySelector("canvas.imglykit-color-picker-hue");
    this._hueKnob = this._element.querySelector(".imglykit-color-picker-hue-container .imglykit-transparent-knob");

    this._saturationCanvas = this._element.querySelector("canvas.imglykit-color-picker-saturation");

    this._transparencyImage = new Image();
    this._transparencyImage.src = ui.helpers.assetPath("ui/night/transparency.png");
    this._transparencyImage.addEventListener("load", this._render.bind(this));

    this._onAlphaKnobDown = this._onAlphaKnobDown.bind(this);
    this._onAlphaKnobDrag = this._onAlphaKnobDrag.bind(this);
    this._onAlphaKnobUp = this._onAlphaKnobUp.bind(this);
    this._onHueKnobDown = this._onHueKnobDown.bind(this);
    this._onHueKnobDrag = this._onHueKnobDrag.bind(this);
    this._onHueKnobUp = this._onHueKnobUp.bind(this);

    this._handleAlphaKnob();
    this._handleHueKnob();
  }

  /**
   * The partial template string
   * @type {String}
   */
  static get template () {
    return fs.readFileSync(__dirname + "/../../../templates/night/generics/color-picker_control.jst", "utf-8");
  }

  /**
   * Sets the given value
   * @param {Number} value
   */
  setValue (value) {
    this._value = value.clone();
    this._render();
  }

  /**
   * Updates and renders all controls to represent the current value
   * @private
   */
  _render () {
    this._renderCurrentColor();
    this._renderTransparency();
    this._renderHue();
    this._renderSaturation();
  }

  /**
   * Renders the currently selected color on the controls canvas
   * @private
   */
  _renderCurrentColor () {
    let canvas = this._currentColorCanvas;
    let context = canvas.getContext("2d");

    let pattern = context.createPattern(this._transparencyImage, "repeat");
    context.rect(0, 0, canvas.width, canvas.height);
    context.fillStyle = pattern;
    context.fill();

    context.fillStyle = this._value.toRGBA();
    context.fill();
  }

  /**
   * Renders the transparency canvas with the current color
   * @private
   */
  _renderTransparency () {
    let canvas = this._alphaCanvas;
    let context = canvas.getContext("2d");

    let pattern = context.createPattern(this._transparencyImage, "repeat");
    context.rect(0, 0, canvas.width, canvas.height);
    context.fillStyle = pattern;
    context.fill();

    let gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, this._value.toHex());
    context.fillStyle = gradient;
    context.fill();

    this._updateAlphaKnob();
  }

  /**
   * Renders the hue canvas
   * @private
   */
  _renderHue () {
    let canvas = this._hueCanvas;
    let context = canvas.getContext("2d");

    let color = new Color();
    for (let y = 0; y < canvas.height; y++) {
      let ratio = y / canvas.height;
      color.fromHSV(ratio, 1, 1);

      context.strokeStyle = color.toRGBA();
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    this._updateHueKnob();
  }

  /**
   * Renders the saturation canvas
   * @private
   */
  _renderSaturation () {
    let canvas = this._saturationCanvas;
    let context = canvas.getContext("2d");
    let [h, s, v] = this._value.toHSV();

    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    let color = new Color(1, 0, 0, 1);
    for (let y = 0; y < canvas.height; y++) {
      let value = (canvas.height - y) / canvas.height;
      for (let x = 0; x < canvas.width; x++) {
        let saturation = x / canvas.width;
        color.fromHSV(h, saturation, value);
        let {r, g, b, a} = color;

        let index = (y * canvas.width + x) * 4;

        imageData.data[index] = r * 255;
        imageData.data[index + 1] = g * 255;
        imageData.data[index + 2] = b * 255;
        imageData.data[index + 3] = a * 255;
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  /**
   * Handles the dragging of the alpha knob
   * @private
   */
  _handleAlphaKnob () {
    this._alphaKnob.addEventListener("mousedown", this._onAlphaKnobDown);
    this._alphaKnob.addEventListener("touchstart", this._onAlphaKnobDown);
  }

  /**
   * Gets called when the user clicks the alpha knob
   * @param {Event} e
   * @private
   */
  _onAlphaKnobDown (e) {
    e.preventDefault();

    this._initialMousePosition = Utils.getEventPosition(e);
    this._alphaBeforeDrag = this._value.a;

    document.addEventListener("mousemove", this._onAlphaKnobDrag);
    document.addEventListener("touchmove", this._onAlphaKnobDrag);

    document.addEventListener("mouseup", this._onAlphaKnobUp);
    document.addEventListener("touchend", this._onAlphaKnobUp);
  }

  /**
   * Gets called when the user drags the alpha knob
   * @param {Event} e
   * @private
   */
  _onAlphaKnobDrag (e) {
    e.preventDefault();

    let mousePosition = Utils.getEventPosition(e);
    let diff = mousePosition.clone()
      .subtract(this._initialMousePosition);

    let canvasWidth = this._alphaCanvas.width;
    let alphaPerPixel = 1 / canvasWidth;

    let newAlpha = this._alphaBeforeDrag + alphaPerPixel * diff.x;
    this._value.a = newAlpha;

    let knobX = canvasWidth * newAlpha;
    knobX = Math.max(0, Math.min(knobX, canvasWidth));
    this._alphaKnob.style.left = `${knobX}px`;

    this.emit("update", this._value);
    this._renderCurrentColor();
  }

  /**
   * Gets called when the user stops dragging the alpha knob
   * @param {Event} e
   * @private
   */
  _onAlphaKnobUp (e) {
    document.removeEventListener("mousemove", this._onAlphaKnobDrag);
    document.removeEventListener("touchmove", this._onAlphaKnobDrag);

    document.removeEventListener("mouseup", this._onAlphaKnobUp);
    document.removeEventListener("touchend", this._onAlphaKnobUp);
  }

  /**
   * Updates the alpha knob position
   * @private
   */
  _updateAlphaKnob () {
    let left = (this._value.a * 100).toFixed(2);
    this._alphaKnob.style.left = `${left}%`;
  }

  /**
   * Handles the dragging of the hue knob
   * @private
   */
  _handleHueKnob () {
    this._hueKnob.addEventListener("mousedown", this._onHueKnobDown);
    this._hueKnob.addEventListener("touchstart", this._onHueKnobDown);
  }

  /**
   * Gets called when the user clicks the hue knob
   * @param {Event} e
   * @private
   */
  _onHueKnobDown (e) {
    e.preventDefault();

    this._initialMousePosition = Utils.getEventPosition(e);
    this._hueBeforeDrag = this._value.toHSV()[0];

    document.addEventListener("mousemove", this._onHueKnobDrag);
    document.addEventListener("touchmove", this._onHueKnobDrag);

    document.addEventListener("mouseup", this._onHueKnobUp);
    document.addEventListener("touchend", this._onHueKnobUp);
  }

  /**
   * Gets called when the user drags the hue knob
   * @param {Event} e
   * @private
   */
  _onHueKnobDrag (e) {
    e.preventDefault();

    let mousePosition = Utils.getEventPosition(e);
    let diff = mousePosition.clone()
      .subtract(this._initialMousePosition);

    let canvasHeight = this._hueCanvas.height;
    let huePerPixel = 1 / canvasHeight;

    let hue = this._hueBeforeDrag + huePerPixel * diff.y;
    hue = Math.max(0, Math.min(hue, 0.99));

    let [h, s, v] = this._value.toHSV();
    this._value.fromHSV(hue, s, v);
    this.emit("update", this._value);
    this._render();
  }

  /**
   * Gets called when the user stops dragging the alpha knob
   * @param {Event} e
   * @private
   */
  _onHueKnobUp (e) {
    document.removeEventListener("mousemove", this._onHueKnobDrag);
    document.removeEventListener("touchmove", this._onHueKnobDrag);

    document.removeEventListener("mouseup", this._onHueKnobUp);
    document.removeEventListener("touchend", this._onHueKnobUp);
  }

  /**
   * Updates the spectrum knob position
   * @private
   */
  _updateHueKnob () {
    let [hue, saturation, luminance] = this._value.toHSV();
    this._hueKnob.style.top = `${hue * 100}%`;
  }
}

export default ColorPicker;
