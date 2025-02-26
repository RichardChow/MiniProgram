Page({
  data: {
    absentRecords: [],
    loading: true
  },

  onShow() {
    this.loadAbsentRecords();
  },

  onPullDownRefresh() {
    this.loadAbsentRecords();
  },

  loadAbsentRecords() {
    const db = wx.cloud.database();
    const _ = db.command;

    this.setData({ loading: true });

    db.collection('reservations')
      .where({
        status: 'absent'
      })
      .orderBy('absentTime', 'desc')
      .get()
      .then(res => {
        console.log('获取到的缺席记录:', res.data);
        // 按 openid 分组
        const groupedRecords = {};
        res.data.forEach(record => {
          // 将服务器时间转换为可读格式
          if (record.absentTime) {
            // 确保absentTime是Date对象
            if (!(record.absentTime instanceof Date)) {
              record.absentTime = new Date(record.absentTime);
            }
            // 格式化为更人性化的显示
            record.absentTimeFormatted = record.absentTime.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
          } else {
            record.absentTimeFormatted = '未知';
          }
          
          // 处理预约时间段
          if (!record.timeSlots || !Array.isArray(record.timeSlots) || record.timeSlots.length === 0) {
            record.timeSlotsFormatted = '未记录';
          } else {
            record.timeSlotsFormatted = record.timeSlots.join(', ');
          }
          
          if (!groupedRecords[record._openid]) {
            groupedRecords[record._openid] = {
              name: record.name,
              count: 0,
              records: []
            };
          }
          groupedRecords[record._openid].count++;
          groupedRecords[record._openid].records.push(record);
        });

        this.setData({
          absentRecords: Object.entries(groupedRecords).map(([openid, data]) => ({
            openid,
            name: data.name,
            count: data.count,
            records: data.records,
            isRestricted: data.count >= 3
          })),
          loading: false
        });

        wx.stopPullDownRefresh();
      })
      .catch(err => {
        console.error('获取缺席记录失败:', err);
        this.setData({ loading: false });
        wx.showToast({
          title: '加载失败',
          icon: 'error'
        });
        wx.stopPullDownRefresh();
      });
  }
}); 