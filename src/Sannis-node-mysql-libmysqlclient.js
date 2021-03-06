/*
Copyright (C) 2010, Oleg Efimov <efimovov@gmail.com>

See license text in LICENSE file
*/

// Require modules
var
  util = require('util'),
  mysql = require('mysql-libmysqlclient'),
  conn;

function fetchAllAsyncBenchmark(callback, cfg) {
  var
    start_time,
    total_time,
    factor = cfg.do_not_run_sync_if_async_exists ? 1 : 2,
    res,
    rows;
  
  start_time = new Date();
  
  res = conn.querySync("SELECT * FROM " + cfg.test_table + ";");
  
  res.fetchAll(function (err, rows) {
    if (err) {
      console.log(err);
    }
    
    res.freeSync();
    
    total_time = ((new Date()) - start_time) / 1000;
    util.puts("**** " + (factor * cfg.insert_rows_count)
                      + " rows async (fetchAll) selected in "
                      + total_time + "s ("
                      + Math.round(factor * cfg.insert_rows_count / total_time)
                      + "/s)");
    
    // Finish benchmark
    conn.closeSync();
    callback.apply();
  });
}

function fetchObjectLoopSyncBenchmark(callback, cfg) {
  var
    start_time,
    total_time,
    factor = cfg.do_not_run_sync_if_async_exists ? 1 : 2,
    res,
    row,
    rows = [];
  
  start_time = new Date();
  
  res = conn.querySync("SELECT * FROM " + cfg.test_table + ";");
  
  row = res.fetchObjectSync();
  
  while (row) {
    rows.push(row);
    
    row = res.fetchObjectSync();
  }
  
  res.freeSync();
  
  total_time = ((new Date()) - start_time) / 1000;
  util.puts("**** " + (factor * cfg.insert_rows_count)
                    + " rows sync (fetchObject in loop) selected in "
                    + total_time + "s ("
                    + Math.round(factor * cfg.insert_rows_count / total_time)
                    + "/s)");
  
  fetchAllAsyncBenchmark(callback, cfg);
}

function insertAsyncBenchmark(callback, cfg) {
  var
    start_time,
    total_time,
    i = 0;
  
  start_time = new Date();
  
  function insertAsync() {
    i += 1;
    if (i <= cfg.insert_rows_count) {
      conn.query(cfg.insert_query, function (err) {
        if (err) {
          console.log(err);
        }
        
        insertAsync();
      });
    } else {
      total_time = ((new Date()) - start_time) / 1000;
      util.puts("**** " + cfg.insert_rows_count
                        + " async insertions in "
                        + total_time + "s ("
                        + Math.round(cfg.insert_rows_count / total_time)
                        + "/s)");
      
      setTimeout(function () {
        fetchObjectLoopSyncBenchmark(callback, cfg);
      }, cfg.delay_before_select);
    }
  }
  
  insertAsync();
}

function insertSyncBenchmark(callback, cfg) {
  var
    start_time,
    total_time,
    i = 0,
    res;
  
  start_time = new Date();
  
  for (i = 0; i < cfg.insert_rows_count; i += 1) {
    res = conn.querySync(cfg.insert_query);
  }
  
  total_time = ((new Date()) - start_time) / 1000;
  util.puts("**** " + cfg.insert_rows_count
                    + " sync insertions in "
                    + total_time + "s ("
                    + Math.round(cfg.insert_rows_count / total_time)
                    + "/s)");
  
  insertAsyncBenchmark(callback, cfg);
}

function reconnectSyncBenchmark(callback, cfg) {
  var
    start_time,
    total_time,
    i = 0;

  start_time = new Date();
  
  for (i = 0; i < cfg.reconnect_count; i += 1) {
    conn.closeSync();
    conn.connectSync(cfg.host, cfg.user, cfg.password, cfg.database);
  }
  
  total_time = ((new Date()) - start_time) / 1000;
  util.puts("**** " + cfg.reconnect_count
                    + " sync reconnects in "
                    + total_time + "s ("
                    + Math.round(cfg.reconnect_count / total_time)
                    + "/s)");
  
  insertSyncBenchmark(callback, cfg);
}

function escapeBenchmark(callback, cfg) {
  var
    start_time,
    total_time,
    i = 0,
    escaped_string;

  start_time = new Date();
  
  for (i = 0; i < cfg.escape_count; i += 1) {
    escaped_string = conn.escapeSync(cfg.string_to_escape);
  }
  
  total_time = ((new Date()) - start_time) / 1000;
  util.puts("**** " + cfg.escape_count
                    + " escapes in "
                    + total_time + "s ("
                    + Math.round(cfg.escape_count / total_time)
                    + "/s)");
  
  reconnectSyncBenchmark(callback, cfg);
}

function startBenchmark(callback, cfg) {
  var
    start_time,
    total_time;
  
  start_time = new Date();
  
  conn = mysql.createConnectionSync();
  conn.connectSync(cfg.host, cfg.user, cfg.password, cfg.database);
  
  conn.querySync("DROP TABLE IF EXISTS " + cfg.test_table + ";");
  conn.querySync(cfg.create_table_query);
  
  total_time = ((new Date()) - start_time) / 1000;
  util.puts("**** Benchmark initialization time is " + total_time + "s");
  
  escapeBenchmark(callback, cfg);
}

exports.run = function (callback, cfg) {
  startBenchmark(callback, cfg);
};

