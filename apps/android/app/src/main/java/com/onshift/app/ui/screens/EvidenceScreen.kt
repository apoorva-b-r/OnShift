package com.onshift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.Evidence
import java.text.NumberFormat
import java.util.Locale

@Composable
fun EvidenceScreen(
    evidenceList: List<Evidence>,
    selectedPlatforms: List<String>
) {
    var filter by remember { mutableStateOf("All") }
    
    val allowedSources = selectedPlatforms + "Bank AA"
    val filteredByPlatforms = evidenceList.filter { it.source in allowedSources }
    
    val sources = listOf("All") + filteredByPlatforms.map { it.source }.distinct()
    
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 0
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.evidence_log),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            
            var expanded by remember { mutableStateOf(false) }
            Box {
                IconButton(onClick = { expanded = true }) {
                    Icon(Icons.Default.FilterList, contentDescription = "Filter")
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    sources.forEach { source ->
                        DropdownMenuItem(
                            text = { Text(source) },
                            onClick = {
                                filter = source
                                expanded = false
                            }
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        val displayList = if (filter == "All") filteredByPlatforms else filteredByPlatforms.filter { it.source == filter }

        if (displayList.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = stringResource(R.string.no_evidence),
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    color = com.onshift.app.ui.theme.TextSecondary
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(displayList) { evidence ->
                    EvidenceItem(evidence, currencyFormatter)
                }
            }
        }
    }
}

@Composable
fun EvidenceItem(evidence: Evidence, formatter: NumberFormat) {
    val badgeColor = when (evidence.source) {
        "Zomato" -> Color(0xFFCB202D)
        "Swiggy" -> Color(0xFFFC8019)
        "Blinkit" -> Color(0xFFFFD337)
        "Bank AA" -> Color(0xFF1976D2)
        else -> Color.Gray
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(badgeColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = evidence.source.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column {
                Text(
                    text = stringResource(R.string.evidence_source, evidence.source),
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    text = stringResource(R.string.evidence_date, evidence.timestamp),
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(4.dp))
                evidence.amount?.let {
                    Text(
                        text = stringResource(R.string.evidence_amount, formatter.format(it)),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Text(
                    text = stringResource(R.string.evidence_type, evidence.type),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}
