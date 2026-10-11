import { NgModule } from '@angular/core';
import { SharedModule, addNavMenuItem, registerDashboardWidget } from '@vendure/admin-ui/core';

/**
 * Registers the "Geo Block" entry in the admin nav (Settings section) and
 * the "Geo Block" dashboard widget. Shared module — loaded eagerly so the
 * nav item and widget exist before the lazy page is ever visited.
 */
@NgModule({
    imports: [SharedModule],
    providers: [
        addNavMenuItem(
            {
                id: 'hulo-vendure-plugin-geo-block',
                label: 'Geo Block',
                routerLink: ['/extensions/geo-block'],
                icon: 'shield',
                requiresPermission: 'ReadCatalog',
            },
            'settings',
        ),
        registerDashboardWidget('hulo-vendure-plugin-geo-block', {
            title: 'Geo Block',
            supportedWidths: [4, 6, 8],
            requiresPermissions: ['ReadCatalog'],
            loadComponent: () => import('./components/geo-block-widget.component').then(m => m.GeoBlockWidgetComponent),
        }),
    ],
})
export class GeoBlockNavModule {}
