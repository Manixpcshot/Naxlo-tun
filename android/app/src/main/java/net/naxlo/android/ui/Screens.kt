package net.naxlo.android.ui

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import kotlinx.coroutines.launch
import net.naxlo.android.R
import net.naxlo.android.core.AppState
import net.naxlo.android.core.ConnectionState
import net.naxlo.android.core.Repo
import net.naxlo.android.core.ServerConfig
import net.naxlo.android.core.Subscription
import net.naxlo.android.vpn.NaxloVpnService
import java.util.Locale

/* ------------------------------------------------------------------ shell */

@Composable
fun AppShell() {
    var tab by remember { mutableStateOf(0) }
    val revision by AppState.revision.collectAsState()
    val context = LocalContext.current

    // Keep the encrypted vault and the UI in sync.
    val state = remember(revision) { Repo.state }

    NaxloTheme {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    val tabs = listOf(
                        R.string.tab_home to Icons.Filled.Bolt,
                        R.string.tab_servers to Icons.Filled.Dns,
                        R.string.tab_subscription to Icons.Filled.Key,
                        R.string.tab_settings to Icons.Filled.Settings
                    )
                    tabs.forEachIndexed { index, (label, icon) ->
                        NavigationBarItem(
                            selected = tab == index,
                            onClick = { tab = index },
                            icon = { Icon(icon, contentDescription = null) },
                            label = { Text(stringResource(label), fontSize = 11.sp) }
                        )
                    }
                }
            }
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                when (tab) {
                    0 -> HomeScreen(state.servers.any { it.supported })
                    1 -> ServersScreen()
                    2 -> SubscriptionScreen(state.subscriptions)
                    3 -> SettingsScreen(context)
                }
            }
        }
    }
}

/* ------------------------------------------------------------------- home */

@Composable
fun HomeScreen(hasServers: Boolean) {
    val connection by AppState.connection.collectAsState()
    val latency by AppState.latency.collectAsState()
    val activeName by AppState.activeServerName.collectAsState()
    val error by AppState.error.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val connected = connection == ConnectionState.CONNECTED
    val accent = MaterialTheme.colorScheme.primary

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            Modifier
                .size(180.dp)
                .border(2.dp, if (connected) accent else MaterialTheme.colorScheme.outline, CircleShape)
                .background(MaterialTheme.colorScheme.surface, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stringResource(
                        when (connection) {
                            ConnectionState.CONNECTED -> R.string.state_connected
                            ConnectionState.STARTING -> R.string.state_starting
                            ConnectionState.STOPPING -> R.string.state_stopping
                            ConnectionState.ERROR -> R.string.state_error
                            else -> R.string.state_idle
                        }
                    ),
                    color = if (connected) accent else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = latency?.let { "$it ms" } ?: stringResource(R.string.untested),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        activeName?.let {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        }
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        }

        Spacer(Modifier.height(28.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = {
                    val intent = Intent(context, NaxloVpnService::class.java)
                    intent.action = if (connected) NaxloVpnService.ACTION_DISCONNECT else NaxloVpnService.ACTION_CONNECT
                    if (connected) {
                        context.startService(intent)
                    } else {
                        intent.putExtra(NaxloVpnService.EXTRA_SERVER_ID, Repo.state.selectedServerId)
                        context.startForegroundService(intent)
                    }
                },
                enabled = hasServers || connected,
                colors = ButtonDefaults.buttonColors(containerColor = accent)
            ) {
                Text(stringResource(if (connected) R.string.disconnect else R.string.connect))
            }
            if (connected) {
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            context.startService(
                                Intent(context, NaxloVpnService::class.java).setAction(NaxloVpnService.ACTION_DISCONNECT)
                            )
                        }
                    },
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.error)
                ) {
                    Text(stringResource(R.string.panic), color = MaterialTheme.colorScheme.error)
                }
            }
        }
        if (!hasServers && !connected) {
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.empty_servers), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
    }
}

/* ---------------------------------------------------------------- servers */

@Composable
fun ServersScreen() {
    val revision by AppState.revision.collectAsState()
    val state = remember(revision) { Repo.state }
    var query by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val servers = state.servers
        .filter { query.isEmpty() || it.name.contains(query, true) }
        .sortedWith(compareByDescending<ServerConfig> { state.pinned.contains(it.id) }.thenBy { it.latencyMs ?: Long.MAX_VALUE })

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(stringResource(R.string.search)) },
            singleLine = true
        )
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(servers, key = { it.id }) { server ->
                ServerRow(server, state.pinned.contains(server.id), state.selectedServerId == server.id) { picked ->
                    when (picked) {
                        "pin" -> Repo.togglePin(server.id)
                        "test" -> scope.launch {
                            val ms = Repo.testLatency(server)
                            Repo.update { current ->
                                current.copy(servers = current.servers.map { if (it.id == server.id) it.copy(latencyMs = ms) else it })
                            }
                            AppState.setLatency(ms)
                        }
                        "connect" -> {
                            Repo.select(server.id)
                            context.startForegroundService(
                                Intent(context, NaxloVpnService::class.java)
                                    .setAction(NaxloVpnService.ACTION_CONNECT)
                                    .putExtra(NaxloVpnService.EXTRA_SERVER_ID, server.id)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ServerRow(server: ServerConfig, pinned: Boolean, selected: Boolean, onAction: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = if (selected) BorderStroke(1.dp, MaterialTheme.colorScheme.primary) else null
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(server.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1)
                Spacer(Modifier.height(4.dp))
                Text(
                    "${server.protocol.uppercase(Locale.ROOT)} · ${server.security.uppercase(Locale.ROOT)} · ${server.network.uppercase(Locale.ROOT)}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp
                )
            }
            Text(
                server.latencyMs?.let { "$it ms" } ?: stringResource(R.string.untested),
                color = if ((server.latencyMs ?: 999) < 400) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp
            )
            IconButton(onClick = { onAction("pin") }) {
                Icon(if (pinned) Icons.Filled.Star else Icons.Filled.StarBorder, contentDescription = stringResource(R.string.pin))
            }
            TextButton(onClick = { onAction("connect") }, enabled = server.supported) {
                Text(stringResource(R.string.connect))
            }
        }
    }
}

/* ----------------------------------------------------------- subscription */

@Composable
fun SubscriptionScreen(subscriptions: List<Subscription>) {
    var url by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val revision by AppState.revision.collectAsState()
    val state = remember(revision) { Repo.state }
    // (uriString, wrongPassword) while asking for an encrypted archive's password.
    var pwDialog by remember { mutableStateOf<Pair<String, Boolean>?>(null) }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { picked ->
            scope.launch {
                val report = runCatching { Repo.importFile(picked.toString(), null) }.getOrNull()
                if (report?.needPassword == true) pwDialog = Pair(picked.toString(), report.wrongPassword)
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("https://…") },
                singleLine = true
            )
            Button(onClick = {
                val trimmed = url.trim()
                if (trimmed.isEmpty()) return@Button
                scope.launch {
                    runCatching { Repo.addSubscription(trimmed) }
                    url = ""
                }
            }) {
                Icon(Icons.Filled.Add, contentDescription = null)
            }
        }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = { filePicker.launch(arrayOf("*/*")) }) {
            Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.add_from_file), fontSize = 13.sp)
        }
        Spacer(Modifier.height(14.dp))
        if (state.subscriptions.isEmpty()) {
            Text(stringResource(R.string.empty_subs), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(state.subscriptions, key = { it.id }) { sub ->
                SubscriptionCard(sub)
            }
        }
    }

    pwDialog?.let { prompt ->
        var pw by remember(prompt.first) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { pwDialog = null },
            containerColor = MaterialTheme.colorScheme.surface,
            title = { Text(stringResource(R.string.file_password_title)) },
            text = {
                Column {
                    Text(stringResource(R.string.file_password_body), fontSize = 13.sp)
                    if (prompt.second) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            stringResource(R.string.file_password_wrong),
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = pw,
                        onValueChange = { pw = it },
                        singleLine = true,
                        label = { Text(stringResource(R.string.file_password_hint)) },
                        visualTransformation = PasswordVisualTransformation()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val entered = pw
                    val uriString = prompt.first
                    pwDialog = null
                    scope.launch {
                        val report = runCatching { Repo.importFile(uriString, entered) }.getOrNull()
                        if (report?.needPassword == true) pwDialog = Pair(uriString, true)
                    }
                }) { Text(stringResource(R.string.file_password_submit)) }
            },
            dismissButton = {
                TextButton(onClick = { pwDialog = null }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}

@Composable
fun SubscriptionCard(sub: Subscription) {
    val scope = rememberCoroutineScope()
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        sub.name ?: sub.url.replace(Regex("^https?://"), "").take(24),
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    if (sub.filePath != null) {
                        Text(
                            stringResource(R.string.file_label),
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 10.sp
                        )
                    }
                    Text(
                        stringResource(R.string.configs_count, Repo.state.servers.count { it.subscriptionId == sub.id }, Repo.state.servers.count { it.subscriptionId == sub.id && it.supported }),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                }
                IconButton(onClick = { scope.launch { runCatching { Repo.refresh(sub.id) } } }) {
                    Icon(Icons.Filled.Refresh, contentDescription = stringResource(R.string.refresh))
                }
                IconButton(onClick = { Repo.removeSubscription(sub.id) }) {
                    Icon(Icons.Filled.Delete, contentDescription = stringResource(R.string.remove))
                }
            }
            sub.userinfo?.let { info ->
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { (info.percent ?: 0) / 100f },
                    modifier = Modifier.fillMaxWidth().height(8.dp),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    QuotaCell(stringResource(R.string.quota_used), humanBytes(info.used))
                    QuotaCell(stringResource(R.string.quota_remaining), info.remaining?.let { humanBytes(it) } ?: stringResource(R.string.unlimited))
                    QuotaCell(stringResource(R.string.quota_total), if (info.total > 0) humanBytes(info.total) else stringResource(R.string.unlimited))
                    info.expire?.let {
                        val days = (it * 1000 - System.currentTimeMillis()) / 86_400_000
                        QuotaCell(
                            stringResource(R.string.quota_expire),
                            if (days < 0) stringResource(R.string.expired) else stringResource(R.string.days_left, days.toInt())
                        )
                    }
                }
            }
            sub.lastError?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun QuotaCell(label: String, value: String) {
    Column {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
        Text(value, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
    }
}

fun humanBytes(bytes: Long): String {
    val units = listOf("B", "KB", "MB", "GB", "TB")
    var value = bytes.toDouble()
    var unit = 0
    while (value >= 1024 && unit < units.lastIndex) {
        value /= 1024
        unit++
    }
    return "%.1f %s".format(value, units[unit])
}

/* --------------------------------------------------------------- settings */

@Composable
fun SettingsScreen(context: android.content.Context) {
    val revision by AppState.revision.collectAsState()
    val state = remember(revision) { Repo.state }

    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(stringResource(R.string.settings_ports), fontWeight = FontWeight.Bold)
        Text(stringResource(R.string.ports_value, 10808, 10809), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Text(stringResource(R.string.no_tun_note), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)

        Spacer(Modifier.height(4.dp))
        Text(stringResource(R.string.language), fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            listOf("fa" to R.string.lang_fa, "en" to R.string.lang_en, "tr" to R.string.lang_tr).forEach { (code, label) ->
                OutlinedButton(
                    onClick = {
                        Repo.setLanguage(code)
                        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(code))
                    },
                    border = BorderStroke(1.dp, if (state.language == code) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)
                ) {
                    Text(stringResource(label))
                }
            }
        }

        Spacer(Modifier.height(4.dp))
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
            Text(
                stringResource(R.string.about_privacy),
                modifier = Modifier.padding(14.dp),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
