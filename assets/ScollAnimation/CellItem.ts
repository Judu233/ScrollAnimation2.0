/*
 * @Author: wss 
 * @Date: 2020-03-27 00:38:10 
 * @Last Modified by: wss
 * @Last Modified time: 2020-03-27 01:01:53
 */

import LoopList from "./LoopList";


const { ccclass, property, executeInEditMode } = cc._decorator;

@ccclass
export default class CellItem extends cc.Component {
    @property(cc.Label)
    label: cc.Label = null;
    @property(cc.Label)
    l2: cc.Label = null;
    @property(cc.Node)
    firstNode: cc.Node = null;

    /**管理列表 */
    mgr: LoopList = null;
    /**当前实际item的Index */
    index = 0;
    /**当前item的虚拟index */
    fictitousIndex = 0;

    /**动画完成进度 */
    private _progress: number = 0.5;
    get progress(): number { return this._progress; }
    set progress(v: number) {
        // cc.log(`设置的progress:${v}`);
        this._progress = v;
    }

    init(mgr: LoopList, progress: number, index: number) {
        this.mgr = mgr;
        this._anim = this.getComponent(cc.Animation);
        this.progress = progress;
        this.index = index;
        this._anim.play();
        this._applySetTime();

        //初始设置
        this.label.string = `index:(${index})`;
    }

    /**从尾->头 or 头->尾 */
    updateItemData() {
        this.firstNode.active = this.fictitousIndex == 0; //判断是否是头部
        this.l2.string = this.mgr.testData[this.fictitousIndex];
    }

    update(dt: number) {
        this._applySetTime();
    }

    //#region  
    /**挂载在节点上的动画节点 */
    _anim: cc.Animation = null;
    /**吸附tween */
    _adsorptionAnim: cc.Tween = null;
    /**停止正在缓动的计时 */
    _stopProgressAction() {
        if (this._adsorptionAnim) {
            this._adsorptionAnim.stop();
            this._adsorptionAnim = null;
        }
    }
    /**更新时间轴 */
    _applySetTime(time: number = this._anim.currentClip.duration * this._progress) {
        if (this._anim.currentClip == null) return;
        //[核心部分] 强制设置动画处于某一个时间节点
        this._anim.setCurrentTime(time);
        this.progress = (this.progress % 1);
    }
    //#endregion
}
