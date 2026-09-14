module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('jobs', {
      id: {
        type: Sequelize.UUID, primaryKey: true, allowNull: false,
        defaultValue: Sequelize.UUIDV4
      },
      name: { type: Sequelize.STRING, allowNull: false, required: true },
      data: { type: Sequelize.JSONB, defaultValue: {} },
      lastFinishedAt: { type: Sequelize.DATE, field: 'last_finished_at' },
      lastModifiedBy: { type: Sequelize.STRING, field: 'last_modified_by' },
      lastRunAt: { type: Sequelize.DATE, field: 'last_run_at' },
      nextRunAt: { type: Sequelize.DATE, field: 'next_run_at' },
      repeatInterval: { type: Sequelize.STRING, field: 'repeat_interval' },
      type: { type: Sequelize.STRING },
      failReason: { type: Sequelize.JSONB, field: 'fail_reason', defaultValue: {} },
      failedAt: { type: Sequelize.DATE, field: 'failed_at' },
      queued: { type: Sequelize.BOOLEAN, defaultValue: false, required: true },
      timezone: {
        type: Sequelize.STRING,
        defaultValue: 'UTC',
        allowNull: false
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'accepted_at'
      },
      failures: {
        defaultValue: 0,
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      created_at: {
        type: Sequelize.DATE, allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE, allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    })
      .then(() => queryInterface.addIndex('jobs', ['name']))
      .then(() => queryInterface.addIndex('jobs', ['next_run_at']));
  },
  down(queryInterface) {
    return queryInterface.dropTable('jobs');
  },
};
