
# Storage abstractions

These storages abstractions add a layer of persistence to Steveo.

Please see the `storage.postgres` packages in this repo for an example.

Concrete implementations of these interfaces provide database vendor specific
implemntations. Implementation details are the responsibility of the module.


## Extending

At the time of writing this was introduced to add persistent storage for the
workflow implementation, however the intention is that this pattern will be
extended in the future for other Steveo features that require data persistence.

