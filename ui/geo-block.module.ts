import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { GeoBlockComponent } from './components/geo-block.component';

@NgModule({
    imports: [
        SharedModule, FormsModule, HttpClientModule,
        RouterModule.forChild([
            { path: '', pathMatch: 'full', component: GeoBlockComponent, data: { breadcrumb: 'Geo-block' } },
        ]),
    ],
    declarations: [GeoBlockComponent],
})
export class GeoBlockModule {}
