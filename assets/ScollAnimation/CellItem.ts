/*
 * @features: 主要功能
 * @description: 内容说明
 * @Date: 2021-03-16 14:13:23
 * @Author: judu233(769471424@qq.com)
 * @LastEditTime: 2021-05-10 14:02:15
 * @LastEditors: judu233
 */

import LoopList from "./LoopList";

const { ccclass, property, executeInEditMode, requireComponent } = cc._decorator;

interface ICellItem {
    mgr: LoopList;
    index: number;
    fictitousIndex: number;
    progress: number;
    _anim: cc.Animation;
    _adsorptionAnim: cc.Tween;
    init(mgr: LoopList, progress: number, index: number): void;
    initFitousIndex(index: number): void;
    updateItemData(): void;
    _stopProgressAction(): void;
    _applySetTime(time?: number): void;
}

@ccclass
@requireComponent(cc.Animation)
export default class CellItem extends cc.Component implements ICellItem {
    testDebug = false;
    testFictiousIndex_lb: cc.Label = null;
    testIndex_lb: cc.Label = null;

    /**管理列表 */
    mgr: LoopList = null;
    /**当前实际item的Index */
    index = 0;
    /**当前item的虚拟index */
    fictitousIndex = 0;

    /**更新item回调 */
    upDateItemCall: () => void;

    /**动画完成进度 */
    private _progress: number = 0.5;
    get progress(): number { return this._progress; }
    set progress(v: number) {
        // cc.log(`设置的progress:${v}`);
        if(isNaN(v))
            return;
            // debugger;
        this._progress = v;
    }

    /**
     * 初始化item
     * @param {LoopList} mgr LoopList
     * @param {number} progress 该item的progress
     * @param {number} index 该item的实际Index
     * @memberof CellItem
     */
    init(mgr: LoopList, progress: number, index: number) {
        this.mgr = mgr;
        this._anim = this.getComponent(cc.Animation);
        this.progress = progress;
        this.index = index;
        if (this._anim && this._anim.defaultClip) {
            if (this._anim.defaultClip.wrapMode != cc.WrapMode.Loop) {
                cc.warn(`动画clip未设置LOOP循环模式`);
            }
            this._anim.play();
        } else {
            cc.error(`未设置默认的clip`);
            this._isError = true;
        }
        this._stopProgressAction();
        this._applySetTime();

        //调试label
        if (this.testDebug) {
            this.testIndex_lb = new cc.Node(`testIndexLabel`).addComponent(cc.Label);
            this.testIndex_lb.string = String(index);
            this.node.addChild(this.testIndex_lb.node, 100);
        }
    }

    /**
     * 初始化虚拟Index
     * @param {number} index 虚拟index
     * @memberof CellItem
     */
    initFitousIndex(index: number) {
        this.fictitousIndex = index;
        //调试label
        if (this.testDebug) {
            this.testFictiousIndex_lb = new cc.Node(`testFictiousIndex_lb`).addComponent(cc.Label);
            this.testFictiousIndex_lb.string = String(index);
            this.node.addChild(this.testFictiousIndex_lb.node, 101);
        }
    }

    /**
     * 更新item的数据，该方法只有在切换头尾的item的时候调用
     * @memberof CellItem
     */
    updateItemData() {
        this.testFictiousIndex_lb && (this.testFictiousIndex_lb.string = String(this.fictitousIndex));
        this.testIndex_lb && (this.testIndex_lb.string = String(this.index));
        this.upDateItemCall && this.upDateItemCall();
    }

    /**
     * 生命周期
     * @param {number} dt 时间dt
     * @memberof CellItem
     */
    update(dt: number) {
        this._applySetTime();
    }

    //#region  
    _isError = false;
    /**挂载在节点上的动画节点 */
    _anim: cc.Animation = null;
    /**吸附tween */
    _adsorptionAnim: cc.Tween = null;
    /**停止正在缓动的动画 */
    _stopProgressAction() {
        if (this._adsorptionAnim) {
            this._adsorptionAnim.stop();
            this._adsorptionAnim = null;
        }
    }
    /**
     * 更新时间轴
     * @param {number} [time] 设置时间  
     * @return {*} 
     * @memberof CellItem
     */
    _applySetTime(time?: number) {
        if (!this._anim || !this._anim.currentClip || this._isError) return;
        if (time == undefined)
            time = this._anim.currentClip.duration * this._progress;
        //[核心部分] 强制设置动画处于某一个时间节点
        this._anim.setCurrentTime(time);
        this.progress = (this.progress % 1);
    }
    //#endregion
}
