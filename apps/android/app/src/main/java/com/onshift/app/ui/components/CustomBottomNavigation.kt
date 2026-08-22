package com.onshift.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.navigation.Screen

data class NavigationTabItem(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector
)

@Composable
fun CustomBottomNavigation(
    currentRoute: String?,
    onTabSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val items = listOf(
        NavigationTabItem(Screen.Home.route, R.string.nav_home, Icons.Default.Home),
        NavigationTabItem(Screen.Evidence.route, R.string.nav_evidence, Icons.Default.Receipt),
        NavigationTabItem(Screen.Credential.route, R.string.nav_credential, Icons.Default.Badge),
        NavigationTabItem(Screen.GovernmentSchemes.route, R.string.nav_schemes, Icons.Default.AccountBalance),
        NavigationTabItem(Screen.Profile.route, R.string.nav_profile, Icons.Default.Person)
    )

    // Deep Navy bar container background #050F2A
    val navyColor = Color(0xFF050F2A)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight()
    ) {
        // Solid background fill #050F2A, full width, height 68dp
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(68.dp)
                .align(Alignment.BottomCenter)
                .background(navyColor)
        )

        // Navigation items row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(68.dp)
                .align(Alignment.BottomCenter),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                val isSelected = currentRoute == item.route
                FloatingBottomNavItem(
                    item = item,
                    isSelected = isSelected,
                    onClick = { onTabSelected(item.route) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
fun FloatingBottomNavItem(
    item: NavigationTabItem,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Selected tab offset animation: raise floating bubble upward by 22dp breaking top bar edge
    val yOffset by animateDpAsState(
        targetValue = if (isSelected) (-22).dp else 0.dp,
        animationSpec = tween(durationMillis = 250),
        label = "yOffset"
    )

    // Circle size animation: 46dp circle when selected, 24dp when unselected
    val circleSize by animateDpAsState(
        targetValue = if (isSelected) 46.dp else 24.dp,
        animationSpec = tween(durationMillis = 250),
        label = "circleSize"
    )

    // Circle background color: #7BBBFF (primary blue) when selected, Transparent when unselected
    val circleBgColor by animateColorAsState(
        targetValue = if (isSelected) Color(0xFF7BBBFF) else Color.Transparent,
        animationSpec = tween(durationMillis = 250),
        label = "circleBgColor"
    )

    // Icon tint color: #050F2A (navy) when selected, #F2FDFF @ 50% opacity when unselected
    val iconTint by animateColorAsState(
        targetValue = if (isSelected) Color(0xFF050F2A) else Color(0xFFF2FDFF).copy(alpha = 0.5f),
        animationSpec = tween(durationMillis = 250),
        label = "iconTint"
    )

    Box(
        modifier = modifier
            .fillMaxHeight()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.offset(y = yOffset)
        ) {
            // Icon inside circle (CircleShape)
            Box(
                modifier = Modifier
                    .size(circleSize)
                    .clip(CircleShape)
                    .background(circleBgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = item.icon,
                    contentDescription = stringResource(id = item.labelRes),
                    tint = iconTint,
                    modifier = Modifier.size(24.dp)
                )
            }

            // Animated visibility for label text and underline strip (Selected tab only)
            AnimatedVisibility(
                visible = isSelected,
                enter = fadeIn(animationSpec = tween(250)) + expandVertically(animationSpec = tween(250)),
                exit = fadeOut(animationSpec = tween(250)) + shrinkVertically(animationSpec = tween(250))
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(top = 3.dp)
                ) {
                    // Tab label text: labelSmall typography, color #F2FDFF
                    Text(
                        text = stringResource(id = item.labelRes),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFF2FDFF),
                        maxLines = 1
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    // Underline strip: color #7BBBFF, 22dp wide x 3dp tall
                    Box(
                        modifier = Modifier
                            .width(22.dp)
                            .height(3.dp)
                            .background(
                                color = Color(0xFF7BBBFF),
                                shape = RoundedCornerShape(1.5.dp)
                            )
                    )
                }
            }
        }
    }
}
