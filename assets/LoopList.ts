
import CellItem from "./CellItem";

const { ccclass, property } = cc._decorator;

@ccclass
export default class LoopList extends cc.Component {
    @property({
        displayName: `列表的容器`,
        tooltip: `显示列表容器，如果为空，本节点添加`,
        type: cc.Node,
    })
    contentContainer: cc.Node = null;

    @property({
        displayName: `itemPrefab`,
        tooltip: `列表容器item里的预制体`,
        type: cc.Prefab
    })
    itemPrefab: cc.Prefab = null;

    /**在屏幕上显示的个数，可见部分 */
    @property({
        displayName: `屏幕显示数量`,
    })
    showCount = 5;

    @property({
        displayName: `开启吸附功能`,
    })
    adsorptionFeatures = true;

    /**吸附格数 */
    adsorptionValue = 0;

    /**存放cellitem的数组列表 */
    private cellItemList: CellItem[] = [];

    /**在屏幕上跑的map */
    private cellItemMap: Map<string, CellItem> = new Map();

    /**是否在触摸滑动 */
    isTouchMove = false;

    /**是否向右滑动 */
    isSwipeRight = false;

    /**滑动加速值 =>加快item移动速度*/
    swipeValue = 5;

    /**记录当前的全局实际的Index */
    private curCenterIndex = 0;

    /**全局虚拟index */
    private fictitousCenterIndex = 0;

    /**滑动时记录的index */
    private swipeIndex = 0;

    private testData: string[] = [];

    onLoad() {
        this.initCells();
    }

    onEnable() {
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable() {
        this.node.off(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    fo(count: number) {
        return function (call: (i: number) => void) {
            for (let ife = 0; ife < count; ife++)
                call && call(ife);
        }
    }

    initCells() {
        this.fo(10)((i) => this.testData[i] = i.toString() + i);

        //设置添加的根节点
        this.contentContainer = this.contentContainer == null ? this.node : this.contentContainer;
        this.adsorptionValue = 1 / this.showCount; //吸附值
        // cc.log(`吸附值：${this.adsorptionValue}`);

        //设置开始记录的index
        this.curCenterIndex = 0;

        //实例化
        let prefab = this.itemPrefab;
        this.fo(this.showCount)((i) => {
            let child = cc.instantiate(prefab);
            this.contentContainer.addChild(child);
            //设置进度位置
            let cellItem = child.getComponent(CellItem);
            cellItem.init(this, 0.5 + i / this.showCount, i);
            cellItem.l2.string = this.testData[i];

            this.cellItemList.push(cellItem);
            this.cellItemMap.set(i.toString(), cellItem);
        });
    }

    onTouchStart() {
        this.swipeIndex = this.fictitousCenterIndex;
    }

    onTouchMove(event: cc.Event.EventTouch) {
        //计算滑动距离
        let delta = event.getDelta().x / this.node.width; // >0 右移动， <0 左移动
        this.isSwipeRight = delta > 0;
        delta += (this.isSwipeRight ? this.swipeValue : - this.swipeValue) / 1000;

        //查找离中心的index-> 计算翻到第几，更新文本数据
        let { centerIndex, maxIndex, minIndex } = this.getIndex();
        let lastIndex = this.swipeIndex;

        this.curCenterIndex = centerIndex;
        let turnPage = Math.floor(this.curCenterIndex - lastIndex);

        this.fictitousCenterIndex = this.cellItemList[this.curCenterIndex].fictitousIndex;
        console.log("当前变量为： ~ file: LoopList.ts ~ line 113 ~ LoopList ~ onTouchMove ~ turnPage", turnPage)

        //更新item位置和数据
        this.cellItemList.forEach(cellItem => {
            //因为 cell 受到动画控制，progress 只在 -1 ~ 0 ~ 1 之间，只要取1的余数就自动循环了，从而避免复杂坐标运算。
            cellItem.progress = (cellItem.progress + delta) % 1;
            cellItem.fictitousIndex += turnPage;
            // cc.log(`信息：`, cellItem.index, cellItem.progress, cellItem.fictitousIndex);
            if (this.isSwipeRight) {
                // cc.log(`右移动`);
                //0 ~ 0.25 && -1 ~ -0.75 更新数据
            } else {
                // cc.log(`左移动`);
                //0.8 ~ 1 && -0.25 ~ 0 更新数据
                if (
                    (cellItem.progress <= 1 && cellItem.progress > 0.8) ||
                    (cellItem.progress <= 0 && cellItem.progress > -0.25)
                )
                    cellItem.l2.string = this.testData[];
            }
        });
        cc.log(`\n`)
        this.isTouchMove = true;
    }

    onTouchEnd() {
        if (this.adsorptionFeatures) {
            /**
             * 自动吸附最近的格数
             *  如果设置的 T > duration => T = T % duration
             *   T < 0 => T = T % duration + duration;
             */

            //查找离中心的index
            let { centerIndex } = this.getIndex();
            //组成最开始的数组方便计算移动位置
            let newList = [...this.cellItemList.slice(centerIndex), ...this.cellItemList.slice(0, centerIndex)];

            newList.forEach((cellItem, index) => {
                //计算移动位置 0~1
                // cc.log(`移动信息：`, cellItem.index, cellItem.progress);
                let interval = index / this.showCount;
                let moveTarget = Math.abs(cellItem.progress > 0 ? (0.5 + interval) : (-0.5 - interval) % 1);

                // let moveDistence = Math.abs(cellItem.progress - moveTarget);
                // cc.log(`移动距离：`, moveDistence);
                if (moveTarget != 0) {
                    //小于0的提前设置,防止移动到错误的位置
                    if (cellItem.progress < 0) {
                        cellItem.progress = 1 - Math.abs(cellItem.progress);
                        cellItem.applySetTime(cellItem.progress);
                    }
                    cc.tween(cellItem)
                        .to(0.2, { progress: moveTarget })
                        .start();
                } else
                    cellItem.progress = moveTarget;//最后一个
            });
        }
        this.isTouchMove = false;
    }

    getIndex() {
        let centerIndex = 0, centerDis = 2;
        let maxIndex = 0, maxDis = 0;
        let minIndex = 0, minDis = 0;
        for (let [index, item] of this.cellItemList.entries()) {
            let progress = item.progress;
            //找距离中心最小的index
            let centerProgress = Math.abs(progress + (progress > 0 ? -0.5 : 0.5));
            if (centerProgress < centerDis) {
                centerIndex = index;
                centerDis = centerProgress;
            }
            let maxProgress = Math.abs(progress + (progress > 0 ? 0 : 1));
            if (maxProgress > maxDis) {
                maxIndex = index;
                maxDis = maxProgress;
            }
            let minProgress = Math.abs(progress + (progress > 0 ? -1 : 0));
            if (minProgress > minDis) {
                minIndex = index;
                minDis = minProgress;
            }
        }
        // cc.log(`中心：${centerIndex}, 最小：${minIndex}, 最大：${maxIndex}`);
        return { centerIndex, maxIndex, minIndex };

    }

    /**查找距离屏幕中心最近的item索引 */
    // findCenterIndex() {
    //     let centerIndex = 0;
    //     let dis = 2;
    //     for (let [index, item] of this.cellItemList.entries()) {
    //         let minx = Math.abs(item.progress + (item.progress > 0 ? -0.5 : 0.5));
    //         if (minx < dis) {
    //             centerIndex = index;
    //             dis = minx;
    //         }
    //     }
    //     // cc.log(`距离中心的item:`, itemIndex);
    //     return centerIndex;

    // }
}
