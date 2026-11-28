/* 群互动演示数据：群待办 / 群投票 / 群相册 / 群签到 */
import type {
	QQGroupAlbum,
	QQGroupCheckin,
	QQGroupTodo,
	QQGroupVote,
} from './types'

export const groupTodos: QQGroupTodo[] = [
	{
		id: 'gt1',
		convId: 'c3',
		title: '确认 Q4 需求评审最终排期',
		creatorId: 'u_linjiahe',
		due: '今天 18:00',
		done: false,
		joined: false,
		doneCount: 86,
		createdAt: '今天 09:32',
	},
	{
		id: 'gt2',
		convId: 'c3',
		title: '补齐首页 / 消息页高保真交互稿',
		creatorId: 'u_suwan',
		due: '明天 12:00',
		done: false,
		joined: false,
		doneCount: 34,
		createdAt: '今天 08:50',
	},
	{
		id: 'gt3',
		convId: 'c3',
		title: '提交本周迭代验收清单',
		creatorId: 'u_chenyu',
		due: '周五 17:00',
		done: true,
		joined: true,
		doneCount: 52,
		createdAt: '昨天 19:10',
	},
	{
		id: 'gt4',
		convId: 'c5',
		title: '统一组件命名规范并同步到文档',
		creatorId: 'u_xujiashu',
		due: '明天 20:00',
		done: false,
		joined: false,
		doneCount: 5,
		createdAt: '今天 10:05',
	},
]

export const groupVotes: QQGroupVote[] = [
	{
		id: 'gv1',
		convId: 'c3',
		title: '下期版本优先做哪个功能？',
		desc: '每人一票，截止明晚 18:00',
		options: [
			{ id: 'gv1o1', text: '群互动增强', votes: 38 },
			{ id: 'gv1o2', text: '深色模式细节', votes: 46 },
			{ id: 'gv1o3', text: '消息性能优化', votes: 27 },
		],
		creatorId: 'u_linjiahe',
		createdAt: '今天 10:20',
		deadline: '明天 18:00',
		closed: false,
	},
	{
		id: 'gv2',
		convId: 'c3',
		title: '团建地点定在哪里？',
		desc: '周六下午出发，投票最多的地点胜出',
		options: [
			{ id: 'gv2o1', text: '云龙湖 · 环湖骑行', votes: 22 },
			{ id: 'gv2o2', text: '大龙湖 · 草坪野餐', votes: 17 },
			{ id: 'gv2o3', text: '户部山 · 老街拍照', votes: 9 },
		],
		creatorId: 'u_suwan',
		createdAt: '昨天 16:40',
		deadline: '周五 20:00',
		closed: false,
	},
	{
		id: 'gv3',
		convId: 'c3',
		title: '周会时间调整到几点？',
		desc: '已结束，结果作为下周一执行的参考',
		options: [
			{ id: 'gv3o1', text: '周三 20:00', votes: 41 },
			{ id: 'gv3o2', text: '周四 20:00', votes: 33 },
		],
		creatorId: 'u_chenyu',
		createdAt: '周三 11:15',
		deadline: '周三 18:00',
		closed: true,
	},
	{
		id: 'gv4',
		convId: 'c5',
		title: '新来的小猫叫什么名字？',
		options: [
			{ id: 'gv4o1', text: '团子', votes: 5 },
			{ id: 'gv4o2', text: '芝麻', votes: 4 },
			{ id: 'gv4o3', text: '布丁', votes: 3 },
		],
		creatorId: 'u_xujiashu',
		createdAt: '今天 09:15',
		deadline: '今天 22:00',
		closed: false,
	},
]

export const groupAlbums: QQGroupAlbum[] = [
	{
		id: 'ga1',
		convId: 'c3',
		name: '团建合影',
		photos: ['/static/qq/m4.jpg', '/static/qq/m6.jpg', '/static/qq/m1.jpg'],
		creatorId: 'u_linjiahe',
		createdAt: '10 月 26 日',
	},
	{
		id: 'ga2',
		convId: 'c3',
		name: '评审现场',
		photos: ['/static/qq/m2.jpg', '/static/qq/m3.jpg', '/static/qq/m5.jpg'],
		creatorId: 'u_suwan',
		createdAt: '11 月 08 日',
	},
	{
		id: 'ga3',
		convId: 'c3',
		name: '办公室日常',
		photos: ['/static/qq/m1.jpg', '/static/qq/m5.jpg', '/static/qq/m2.jpg', '/static/qq/m4.jpg'],
		creatorId: 'u_zhengyinuo',
		createdAt: '11 月 20 日',
	},
	{
		id: 'ga4',
		convId: 'c5',
		name: '猫咪日常',
		photos: ['/static/qq/m5.jpg', '/static/qq/m1.jpg', '/static/qq/m4.jpg'],
		creatorId: 'u_xujiashu',
		createdAt: '11 月 22 日',
	},
]

/** 群签到初始状态，首次访问时拷贝进 store */
export function initialCheckin(convId: string): QQGroupCheckin {
	if (convId === 'c5') {
		return {
			convId,
			checked: false,
			streak: 3,
			total: 9,
			todayCount: 4,
			board: [
				{ userId: 'u_xujiashu', time: '08:40', streak: 5 },
				{ userId: 'u_chenyu', time: '09:12', streak: 4 },
				{ userId: 'u_suwan', time: '09:30', streak: 3 },
			],
		}
	}
	return {
		convId,
		checked: false,
		streak: 6,
		total: 23,
		todayCount: 37,
		board: [
			{ userId: 'u_suwan', time: '08:12', streak: 12 },
			{ userId: 'u_chenyu', time: '08:20', streak: 9 },
			{ userId: 'u_xujiashu', time: '08:31', streak: 7 },
			{ userId: 'u_zhengyinuo', time: '08:45', streak: 6 },
			{ userId: 'u_yansiyuan', time: '09:02', streak: 5 },
			{ userId: 'u_lizhixia', time: '09:15', streak: 4 },
			{ userId: 'u_fangyuan', time: '09:28', streak: 3 },
			{ userId: 'u_songqinghe', time: '09:40', streak: 2 },
		],
	}
}
