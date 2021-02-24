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

    /**管理列表 */
    mgr: LoopList = null;

    /**当前item的Index */
    index = 0;
    
    /**当前item的虚拟index */
    fictitousIndex = 0;

    anim: cc.Animation = null;

    /**动画完成进度 */
    private _progress: number = 0.5;
    public get progress(): number {
        return this._progress;
    }
    public set progress(v: number) {
        // cc.log(`设置的progress:${v}`);
        this._progress = v;
    }

    public init(mgr: LoopList, progress: number, index: number) {
        this.mgr = mgr;
        this.anim = this.getComponent(cc.Animation);
        this.progress = progress;
        this.fictitousIndex = index;
        this.index = index;
        this.label.string = `index:(${index})`;
        this.anim.play();
    }

    applySetTime(time: number = this.anim.currentClip.duration * this._progress) {
        if (this.anim.currentClip == null) return;

        //[核心部分] 强制设置动画处于某一个时间节点
        this.anim.setCurrentTime(time);
    }

    getAnimDuration() {
        return this.anim.currentClip.duration;
    }

    update(dt) {
        this.applySetTime();
    }
}
