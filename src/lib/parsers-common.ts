// Describes the type of a given query.
export enum MySQLQueryType {
  QtUnknown,
  QtAmbiguous,

  // DDL
  QtAlterDatabase,
  QtAlterLogFileGroup,
  QtAlterFunction,
  QtAlterProcedure,
  QtAlterServer,
  QtAlterTable,
  QtAlterTableSpace,
  QtAlterEvent,
  QtAlterView,

  QtCreateTable,
  QtCreateIndex,
  QtCreateDatabase,
  QtCreateEvent,
  QtCreateView,
  QtCreateRoutine, // All of procedure, function, UDF. Used for parse type.
  QtCreateProcedure,
  QtCreateFunction,
  QtCreateUdf,
  QtCreateTrigger,
  QtCreateLogFileGroup,
  QtCreateServer,
  QtCreateTableSpace,

  QtDropDatabase,
  QtDropEvent,
  QtDropFunction, // Includes UDF.
  QtDropProcedure,
  QtDropIndex,
  QtDropLogfileGroup,
  QtDropServer,
  QtDropTable,
  QtDropTablespace,
  QtDropTrigger,
  QtDropView,

  QtRenameTable,
  QtTruncateTable,

  // DML
  QtCall,
  QtDelete,
  QtDo,

  QtHandler, // Do we need Handler open/close etc.?

  QtInsert,
  QtLoadData,
  QtLoadXML,
  QtReplace,
  QtSelect,
  QtUpdate,

  QtPartition, // Cannot be used standalone.

  QtStartTransaction,
  QtBeginWork,
  QtCommit,
  QtRollbackWork,
  QtSetAutoCommit, // "set autocommit" is especially mentioned in transaction help, so identify this too.
  QtSetTransaction,

  QtSavepoint,
  QtReleaseSavepoint,
  QtRollbackSavepoint,

  QtLock,
  QtUnlock,

  QtXA, // Do we need xa start, xa end etc.?

  QtPurge,
  QtChangeMaster,
  QtReset,
  QtResetMaster,
  QtResetSlave,
  QtStartSlave,
  QtStopSlave,
  QtLoadDataMaster,
  QtLoadTableMaster,

  QtPrepare,
  QtExecute,
  QtDeallocate,

  // Database administration
  QtAlterUser,
  QtCreateUser,
  QtDropUser,
  QtGrantProxy,
  QtGrant,
  QtRenameUser,
  QtRevokeProxy,
  QtRevoke,

  QtAnalyzeTable,
  QtCheckTable,
  QtChecksumTable,
  QtOptimizeTable,
  QtRepairTable,
  QtBackUpTable,
  QtRestoreTable,

  QtInstallPlugin,
  QtUninstallPlugin,

  QtSet, // Any variable assignment.
  QtSetPassword,

  QtShow,
  QtShowAuthors,
  QtShowBinaryLogs,
  QtShowBinlogEvents,
  QtShowRelaylogEvents,
  QtShowCharset,
  QtShowCollation,
  QtShowColumns,
  QtShowContributors,
  QtShowCreateDatabase,
  QtShowCreateEvent,
  QtShowCreateFunction,
  QtShowCreateProcedure,
  QtShowCreateTable,
  QtShowCreateTrigger,
  QtShowCreateView,
  QtShowDatabases,
  QtShowEngineStatus,
  QtShowStorageEngines,
  QtShowErrors,
  QtShowEvents,
  QtShowFunctionCode,
  QtShowFunctionStatus,
  QtShowGrants,
  QtShowIndexes, // Index, Indexes, Keys
  QtShowInnoDBStatus,
  QtShowMasterStatus,
  QtShowOpenTables,
  QtShowPlugins,
  QtShowProcedureStatus,
  QtShowProcedureCode,
  QtShowPrivileges,
  QtShowProcessList,
  QtShowProfile,
  QtShowProfiles,
  QtShowSlaveHosts,
  QtShowSlaveStatus,
  QtShowStatus,
  QtShowVariables,
  QtShowTableStatus,
  QtShowTables,
  QtShowTriggers,
  QtShowWarnings,

  QtCacheIndex,
  QtFlush,
  QtKill, // Connection, Query
  QtLoadIndex,

  QtExplainTable,
  QtExplainStatement,
  QtHelp,
  QtUse,

  QtSentinel
}
