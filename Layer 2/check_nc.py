import xarray as xr
import glob

# Yeh code automatically us folder ki pehli .nc file utha lega
nc_file = glob.glob("*.nc")[0] 
ds = xr.open_dataset(nc_file)
print(ds.data_vars)